"""
MongoDB Client - Singleton Connection Manager

Purpose: Centralized MongoDB connection with proper error handling and resilient fallback.
Features:
- Singleton pattern (one connection pool for entire app)
- Automatic reconnection on failure
- Connection pooling
- Resilient local persistence store fallback if MongoDB server is offline
- Detailed logging
"""

import logging
import os
import json
import uuid
import re
from pathlib import Path
from typing import Optional, Dict, List, Any, Union
from datetime import datetime
from pymongo import MongoClient
from pymongo.database import Database
from pymongo.collection import Collection
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError
from dotenv import load_dotenv

# Search and load .env from backend directory or parent directories
_env_candidates = [
    Path(__file__).resolve().parent.parent / '.env',
    Path(os.getcwd()) / 'backend' / '.env',
    Path(os.getcwd()) / '.env'
]
for _env_path in _env_candidates:
    if _env_path.exists():
        load_dotenv(dotenv_path=_env_path)
        break
else:
    load_dotenv()

logger = logging.getLogger(__name__)

# Data directory for resilient fallback storage
DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)


class InsertOneResult:
    """Mock PyMongo InsertOneResult"""
    def __init__(self, inserted_id):
        self.inserted_id = inserted_id


class UpdateResult:
    """Mock PyMongo UpdateResult"""
    def __init__(self, matched_count: int, modified_count: int, upserted_id=None):
        self.matched_count = matched_count
        self.modified_count = modified_count
        self.upserted_id = upserted_id


class DeleteResult:
    """Mock PyMongo DeleteResult"""
    def __init__(self, deleted_count: int):
        self.deleted_count = deleted_count


class ResilientStoreCollection:
    """
    File-backed resilient collection providing PyMongo-compatible interface
    when MongoDB server is offline or unreachable.
    """
    def __init__(self, collection_name: str):
        self.name = collection_name
        self.file_path = DATA_DIR / f"{collection_name}.json"
        self._indexes = []

    def _read_data(self) -> List[Dict[str, Any]]:
        if not self.file_path.exists():
            return []
        try:
            with open(self.file_path, "r", encoding="utf-8") as f:
                content = f.read().strip()
                if not content:
                    return []
                return json.loads(content)
        except Exception as e:
            logger.warning(f"Failed reading resilient store {self.name}: {e}")
            return []

    def _write_data(self, docs: List[Dict[str, Any]]) -> None:
        try:
            # Atomic write via temp file
            temp_path = self.file_path.with_suffix(".tmp")
            with open(temp_path, "w", encoding="utf-8") as f:
                json.dump(docs, f, indent=2, default=str)
            temp_path.replace(self.file_path)
        except Exception as e:
            logger.error(f"Failed writing resilient store {self.name}: {e}")

    def _match_filter(self, doc: Dict[str, Any], filter_dict: Dict[str, Any]) -> bool:
        if not filter_dict:
            return True
        for k, v in filter_dict.items():
            if k == "$or" and isinstance(v, list):
                if not any(self._match_filter(doc, sub) for sub in v):
                    return False
                continue
            if k == "$and" and isinstance(v, list):
                if not all(self._match_filter(doc, sub) for sub in v):
                    return False
                continue

            doc_val = doc.get(k)
            if isinstance(v, dict):
                # Handle operators
                if "$regex" in v:
                    pattern = v["$regex"]
                    options = v.get("$options", "")
                    flags = re.IGNORECASE if "i" in options else 0
                    if not (doc_val and re.search(pattern, str(doc_val), flags)):
                        return False
                elif "$in" in v:
                    if doc_val not in v["$in"]:
                        return False
                elif "$ne" in v:
                    if doc_val == v["$ne"]:
                        return False
                elif "$gte" in v:
                    if doc_val is None or doc_val < v["$gte"]:
                        return False
                elif "$lte" in v:
                    if doc_val is None or doc_val > v["$lte"]:
                        return False
                elif "$gt" in v:
                    if doc_val is None or doc_val <= v["$gt"]:
                        return False
                elif "$lt" in v:
                    if doc_val is None or doc_val >= v["$lt"]:
                        return False
            else:
                if str(doc_val) != str(v):
                    return False
        return True

    def find(self, filter_dict: Optional[Dict[str, Any]] = None, projection: Optional[Dict[str, Any]] = None, **kwargs) -> 'ResilientCursor':
        filter_dict = filter_dict or {}
        data = self._read_data()
        matched = [d for d in data if self._match_filter(d, filter_dict)]
        return ResilientCursor(matched)

    def find_one(self, filter_dict: Optional[Dict[str, Any]] = None, projection: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
        filter_dict = filter_dict or {}
        data = self._read_data()
        for d in data:
            if self._match_filter(d, filter_dict):
                return dict(d)
        return None

    def insert_one(self, doc: Dict[str, Any]) -> InsertOneResult:
        data = self._read_data()
        to_save = dict(doc)
        if "_id" not in to_save:
            to_save["_id"] = str(uuid.uuid4())
        data.append(to_save)
        self._write_data(data)
        return InsertOneResult(to_save["_id"])

    def update_one(self, filter_dict: Dict[str, Any], update: Dict[str, Any], upsert: bool = False) -> UpdateResult:
        data = self._read_data()
        matched = False
        modified = 0

        for idx, doc in enumerate(data):
            if self._match_filter(doc, filter_dict):
                matched = True
                updated = dict(doc)
                if "$set" in update:
                    for sk, sv in update["$set"].items():
                        updated[sk] = sv
                if "$push" in update:
                    for pk, pv in update["$push"].items():
                        curr_list = updated.get(pk, [])
                        if not isinstance(curr_list, list):
                            curr_list = []
                        curr_list.append(pv)
                        updated[pk] = curr_list
                if "$inc" in update:
                    for ik, iv in update["$inc"].items():
                        updated[ik] = updated.get(ik, 0) + iv
                data[idx] = updated
                modified = 1
                break

        if not matched and upsert:
            new_doc = dict(filter_dict)
            if "$set" in update:
                new_doc.update(update["$set"])
            if "_id" not in new_doc:
                new_doc["_id"] = str(uuid.uuid4())
            data.append(new_doc)
            self._write_data(data)
            return UpdateResult(0, 1, upserted_id=new_doc["_id"])

        if modified:
            self._write_data(data)
        return UpdateResult(1 if matched else 0, modified)

    def update_many(self, filter_dict: Dict[str, Any], update: Dict[str, Any], upsert: bool = False) -> UpdateResult:
        data = self._read_data()
        matched = 0
        modified = 0

        for idx, doc in enumerate(data):
            if self._match_filter(doc, filter_dict):
                matched += 1
                updated = dict(doc)
                if "$set" in update:
                    for sk, sv in update["$set"].items():
                        updated[sk] = sv
                if "$push" in update:
                    for pk, pv in update["$push"].items():
                        curr_list = updated.get(pk, [])
                        if not isinstance(curr_list, list):
                            curr_list = []
                        curr_list.append(pv)
                        updated[pk] = curr_list
                if "$inc" in update:
                    for ik, iv in update["$inc"].items():
                        updated[ik] = updated.get(ik, 0) + iv
                data[idx] = updated
                modified += 1

        if matched == 0 and upsert:
            new_doc = dict(filter_dict)
            if "$set" in update:
                new_doc.update(update["$set"])
            if "_id" not in new_doc:
                new_doc["_id"] = str(uuid.uuid4())
            data.append(new_doc)
            self._write_data(data)
            return UpdateResult(0, 1, upserted_id=new_doc["_id"])

        if modified:
            self._write_data(data)
        return UpdateResult(matched, modified)

    def delete_many(self, filter_dict: Dict[str, Any]) -> DeleteResult:
        data = self._read_data()
        new_data = []
        deleted = 0
        for doc in data:
            if self._match_filter(doc, filter_dict):
                deleted += 1
                continue
            new_data.append(doc)
        if deleted:
            self._write_data(new_data)
        return DeleteResult(deleted)

    def delete_one(self, filter_dict: Dict[str, Any]) -> DeleteResult:
        data = self._read_data()
        new_data = []
        deleted = 0
        for doc in data:
            if not deleted and self._match_filter(doc, filter_dict):
                deleted = 1
                continue
            new_data.append(doc)
        if deleted:
            self._write_data(new_data)
        return DeleteResult(deleted)

    def delete_many(self, filter_dict: Dict[str, Any]) -> DeleteResult:
        data = self._read_data()
        new_data = [d for d in data if not self._match_filter(d, filter_dict)]
        deleted_count = len(data) - len(new_data)
        if deleted_count > 0:
            self._write_data(new_data)
        return DeleteResult(deleted_count)

    def count_documents(self, filter_dict: Optional[Dict[str, Any]] = None) -> int:
        filter_dict = filter_dict or {}
        data = self._read_data()
        return sum(1 for d in data if self._match_filter(d, filter_dict))

    def distinct(self, key: str, filter_dict: Optional[Dict[str, Any]] = None) -> List[Any]:
        filter_dict = filter_dict or {}
        data = self._read_data()
        vals = set()
        for d in data:
            if self._match_filter(d, filter_dict):
                v = d.get(key)
                if v is not None:
                    vals.add(v)
        return list(vals)

    def create_index(self, keys, **kwargs):
        self._indexes.append({"keys": keys, "kwargs": kwargs})
        return "index_created"


class ResilientCursor:
    """Cursor wrapper for chained query operations"""
    def __init__(self, data: List[Dict[str, Any]]):
        self._data = data

    def sort(self, key_or_list: Union[str, List], direction: int = 1) -> 'ResilientCursor':
        if isinstance(key_or_list, list):
            for k, d in reversed(key_or_list):
                rev = (d == -1)
                self._data.sort(key=lambda x: (x.get(k) is None, x.get(k, "")), reverse=rev)
        else:
            rev = (direction == -1)
            self._data.sort(key=lambda x: (x.get(key_or_list) is None, x.get(key_or_list, "")), reverse=rev)
        return self

    def skip(self, count: int) -> 'ResilientCursor':
        self._data = self._data[count:]
        return self

    def limit(self, count: int) -> 'ResilientCursor':
        self._data = self._data[:count]
        return self

    def __iter__(self):
        return iter(self._data)

    def __len__(self):
        return len(self._data)


class ResilientDatabase:
    """Mock PyMongo Database wrapping ResilientStoreCollections"""
    def __init__(self, db_name: str):
        self.name = db_name
        self._collections: Dict[str, ResilientStoreCollection] = {}

    def __getitem__(self, collection_name: str) -> ResilientStoreCollection:
        if collection_name not in self._collections:
            self._collections[collection_name] = ResilientStoreCollection(collection_name)
        return self._collections[collection_name]

    def list_collection_names(self) -> List[str]:
        files = list(DATA_DIR.glob("*.json"))
        return [f.stem for f in files]


class MongoDBClient:
    """
    Singleton MongoDB client with connection management and resilient fallback
    """
    _instance: Optional['MongoDBClient'] = None
    _client: Optional[MongoClient] = None
    _db: Optional[Any] = None
    _is_connected: bool = False
    _db_name: str = "resumate_db"
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(MongoDBClient, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if getattr(self, '_initialized', False):
            return
        self._initialized = True
        self._connect()
    
    def _connect(self):
        """Establish MongoDB connection or activate resilient store"""
        mongo_uri = os.getenv('MONGO_URI') or os.getenv('MONGODB_URI') or os.getenv('MONGODB_ATLAS_URI') or "mongodb://localhost:27017/"
        self._db_name = os.getenv('MONGO_DB_NAME', 'resumate_db')
        
        try:
            logger.info("🔄 Connecting to MongoDB...")
            self._client = MongoClient(
                mongo_uri,
                maxPoolSize=50,
                minPoolSize=5,
                serverSelectionTimeoutMS=2000,
                connectTimeoutMS=3000,
                retryWrites=True
            )
            # Test connection
            self._client.admin.command('ping')
            self._db = self._client[self._db_name]
            self._is_connected = True
            logger.info(f"✅ MongoDB connection established successfully! Database: {self._db_name}")
        except Exception as e:
            self._is_connected = False
            self._client = None
            self._db = ResilientDatabase(self._db_name)
            logger.warning(f"⚠️ MongoDB server is not running or unreachable ({str(e)}). Active resilient persistence store engaged.")

    def get_database(self) -> Any:
        if self._db is None:
            self._connect()
        return self._db

    def get_collection(self, collection_name: str) -> Any:
        db = self.get_database()
        return db[collection_name]

    def ping(self) -> bool:
        if not self._is_connected or self._client is None:
            # Check if live server became available
            try:
                mongo_uri = os.getenv('MONGO_URI') or os.getenv('MONGODB_URI') or "mongodb://localhost:27017/"
                test_client = MongoClient(mongo_uri, serverSelectionTimeoutMS=1000)
                test_client.admin.command('ping')
                self._connect()
                return self._is_connected
            except Exception:
                return False
        try:
            self._client.admin.command('ping')
            return True
        except Exception:
            self._is_connected = False
            return False

    def is_connected(self) -> bool:
        return self._is_connected

    def get_stats(self) -> dict:
        try:
            if self._is_connected and self._client:
                stats = self._client[self._db_name].command('dbStats')
                return {
                    'database': self._db_name,
                    'mode': 'mongodb',
                    'connected': True,
                    'collections': stats.get('collections', 0),
                    'objects': stats.get('objects', 0)
                }
            return {
                'database': self._db_name,
                'mode': 'resilient_store',
                'connected': False,
                'collections': len(self.get_database().list_collection_names()),
                'data_dir': str(DATA_DIR)
            }
        except Exception as e:
            return {'error': str(e), 'mode': 'resilient_store', 'connected': False}

    def close(self):
        if self._client:
            try:
                self._client.close()
            except Exception:
                pass
            self._client = None
            self._db = None
            self._is_connected = False


# Global singleton instance
_mongo_client: Optional[MongoDBClient] = None

def get_mongo_client() -> MongoDBClient:
    global _mongo_client
    if _mongo_client is None:
        _mongo_client = MongoDBClient()
    return _mongo_client

def get_db() -> Any:
    return get_mongo_client().get_database()

def get_collection(collection_name: str) -> Any:
    return get_mongo_client().get_collection(collection_name)

def ping_db() -> bool:
    return get_mongo_client().ping()

def close_db():
    global _mongo_client
    if _mongo_client:
        _mongo_client.close()
        _mongo_client = None
