# 🚀 Deployment Guide — AI Interview Agent

This guide documents environment variables, build commands, and the post-deployment verification checklist for production.

---

## 📋 Required Environment Variables

### 1. Frontend (Vercel)
Set these in the **Vercel Project Dashboard** under **Settings → Environment Variables**:

| Variable | Description | Example Value |
|---|---|---|
| `VITE_API_URL` | Live URL of the FastAPI backend on Render | `https://ai-interview-agent-n4bf.onrender.com` |
| `VITE_WS_URL` | Live WebSocket endpoint for real-time interview audio | `wss://ai-interview-agent-n4bf.onrender.com` |

---

### 2. Backend (Render / Cloud Container)
Set these in the **Render Dashboard** under **Environment Variables**:

| Variable | Required? | Description | Example Value |
|---|---|---|---|
| `ENVIRONMENT` | **Yes** | Operating mode (`production` or `development`) | `production` |
| `ALLOWED_ORIGINS` | **Yes** | Comma-separated list of allowed frontend origins | `https://ai-interview-agent-three-taupe.vercel.app` |
| `PORT` | **Yes** | Port assigned dynamically by Render | `10000` |
| `GROQ_API_KEY` | **Yes** | Groq API Key for LLaMA 3.3 and Whisper models | `gsk_...` |
| `BACKEND_URL` | Optional | Public base URL of backend | `https://ai-interview-agent-n4bf.onrender.com` |
| `MONGODB_URI` | Optional | MongoDB Atlas Connection String (falls back to resilient JSON DB) | `mongodb+srv://...` |
| `JWT_SECRET` | Optional | Secret key for signing session tokens | `32+ character random string` |

---

## 🛠️ Build & Startup Instructions

### Frontend (Vercel)
- **Framework Preset**: `Vite`
- **Root Directory**: `./`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

### Backend (Render Web Service)
- **Runtime**: `Python 3`
- **Build Command**: `pip install -r backend/requirements.txt`
- **Start Command**: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`

---

## ✅ Post-Deployment Verification Checklist

Once both services are deployed, verify the full flow:

1. **Backend Health Check**:
   - Request: `GET https://ai-interview-agent-n4bf.onrender.com/api/health`
   - Expected: `200 OK` with JSON containing `status: "healthy"` and components status.

2. **CORS Preflight Check**:
   - Make an `OPTIONS` request with `Origin: https://ai-interview-agent-three-taupe.vercel.app`.
   - Expected: `Access-Control-Allow-Origin` matches the frontend domain. Localhost is blocked in production mode.

3. **Rate Limiting Check**:
   - Send 6 rapid invalid login requests from one IP.
   - Expected: 6th request returns `429 Too Many Requests`.

4. **Candidate Access Control (RBAC 403 Test)**:
   - Request `GET /api/candidates` with a candidate token or `X-User-Role: CANDIDATE`.
   - Expected: `403 Forbidden` (`Candidates are not authorized to access recruiter resources`).

5. **Live Video Interview Portal**:
   - Open `https://ai-interview-agent-three-taupe.vercel.app/login`
   - Sign in as candidate or open an interview room link (`/interview`).
   - Expected: Video/audio room initializes, microphone test passes.
