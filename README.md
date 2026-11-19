# 🧠 AI Interview Agent

> **Autonomous Video Screening, Adaptive Technical Assessment & Recruiter Intelligence Platform**  
> GitHub Repository: [https://github.com/ashishyadav024/AI-Interview-Agent](https://github.com/ashishyadav024/AI-Interview-Agent)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Python 3.11](https://img.shields.io/badge/Python-3.11-3776AB.svg?logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React 18](https://img.shields.io/badge/React-18.3-61DAFB.svg?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC.svg?logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![Groq LLaMA 3.3](https://img.shields.io/badge/LLM-Groq%20LLaMA%203.3%2070B-F05032.svg)](https://groq.com)
[![Vite](https://img.shields.io/badge/Bundler-Vite-646CFF.svg?logo=vite&logoColor=white)](https://vitejs.dev)

---

## 🌟 Overview

**AI Interview Agent** is a full-stack, enterprise-grade autonomous recruitment platform designed to eliminate hiring bottlenecks. It conducts live interactive video technical interviews with candidates, assesses their verbal and coding reasoning in real time, monitors anti-cheat proctoring telemetry, and synthesizes multi-dimensional scorecards for hiring managers.

```
HR Uploads Role / Candidates
            ↓
AI Generates Calibrated Technical Question Rubrics
            ↓
Single-Use 48h Secure Invitation Sent to Candidate
            ↓
Candidate Enters Live Assessment Room (Video + Audio)
            ↓
AI Agent Conducts Live Interview (Whisper STT → LLaMA 3.3 Reasoning → Deepgram TTS)
            ↓
Real-Time Proctoring & Anti-Cheat Telemetry Logged
            ↓
Instant Scorecard Synthesis & Recruiter Analytics Ready in Dashboard
```

---

## ✨ Key Features

### 🎙️ 1. Autonomous AI Interview Conductor
- **Real-Time Voice & Video**: WebRTC video stream paired with ultra-low latency speech transcription.
- **LLM Reasoning Engine**: Powered by **Groq LLaMA 3.3 70B Versatile** for dynamic follow-up generation and answer calibration.
- **Speech Recognition & Synthesis**: Groq Whisper Large V3 STT (~150ms latency) and Deepgram Aura / Web Speech API TTS fallbacks.
- **Adaptive Questioning**: Automatically branches into deeper architectural or problem-solving inquiries based on candidate responses.

### 🛡️ 2. Proctoring & Anti-Cheat Telemetry
- **Tab-Switch & Blur Monitoring**: Tracks candidate window changes and flags irregularities in real time.
- **Microphone & Presence Watcher**: Detects abnormal audio drops or secondary device activity.
- **Time-Stamped Incident Log**: Recruiter scorecards display an audit trail of flags with severity levels.

### 📊 3. Recruiter Intelligence Workspace
- **Pipeline Overview**: High-velocity candidate management with searchable and sortable list views.
- **Multi-Track Calibrated Scoring**:
  - **Technical Competency (40%)**
  - **Problem Solving & Architecture (30%)**
  - **Communication & Clarity (30%)**
- **Visual Analytics**: Interactive Recharts graphs showing pass rates, interview velocity, and skill distributions.
- **Scorecard Synthesis & PDF Export**: Instant hire recommendations with strengths, growth areas, and transcript playback.

### 🔐 4. Enterprise Security & Access Control
- **Role-Based Access Control (RBAC)**: Distinct permissions for `RECRUITER`, `CANDIDATE`, and `ADMIN`.
- **Single-Use Invitations**: Expiring, cryptographically secure 48-hour interview links.
- **Zero-Data Leakage**: Built-in fallback database and zero hardcoded credentials.

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       CLIENT TIER                           │
│  ┌─────────────────────────┐   ┌─────────────────────────┐  │
│  │   Candidate Portal      │   │   Recruiter Workspace   │  │
│  │   - Live Video / Audio  │   │   - Pipeline Analytics  │  │
│  │   - Whisper STT Capture │   │   - Scorecard Reviews   │  │
│  │   - Anti-Cheat Watcher  │   │   - Link Provisioning   │  │
│  └────────────┬────────────┘   └────────────┬────────────┘  │
└───────────────┼─────────────────────────────┼───────────────┘
                │ HTTP / WebSocket            │ REST API
┌───────────────▼─────────────────────────────▼───────────────┐
│                    FASTAPI BACKEND (8001)                   │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  LangGraph Interview Conductor & Evaluation Agent     │  │
│  │  - Groq LLaMA 3.3 70B (Orchestrator & Evaluator)      │  │
│  │  - Groq Whisper Large V3 (Audio Transcription)       │  │
│  │  - Deepgram Aura / Web Speech (Voice Generation)      │  │
│  └──────────────────────────┬────────────────────────────┘  │
│                             │                               │
│  ┌──────────────────────────▼────────────────────────────┐  │
│  │  Storage Repositories & Security Middleware           │  │
│  │  - MongoDB Atlas (Persistent Cluster)                 │  │
│  │  - Local High-Reliability JSON DB (Fallback Engine)   │  │
│  │  - JWT Bearer Token Session Verifier                  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons, Recharts, Framer Motion, Radix UI |
| **Backend API** | FastAPI, Python 3.11, Pydantic v2, Uvicorn |
| **AI / LLM Orchestration** | LangGraph, LangChain, Groq API (LLaMA 3.3 70B Versatile, Whisper Large V3) |
| **Speech & Audio** | Groq Whisper Large V3, Deepgram Aura TTS, Web Speech Synthesis API |
| **Database & Cache** | MongoDB Atlas, Local JSON persistence fallback engine |
| **Styling & Design System** | Modern Stitch UI, custom responsive CSS variables |

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js** >= 18.0.0
- **Python** >= 3.10
- **Groq API Key** ([Get free key at console.groq.com](https://console.groq.com))

---

### Option A: One-Command Startup (Windows PowerShell)

Run the included orchestrator script to automatically verify dependencies, start the backend, and launch the frontend:

```powershell
.\start_demo.ps1
```

---

### Option B: Manual Setup

#### 1. Clone the Repository
```bash
git clone https://github.com/ashishyadav024/AI-Interview-Agent.git
cd AI-Interview-Agent
```

#### 2. Backend Setup
```bash
# Navigate to backend
cd backend

# Create and activate virtual environment
python -m venv .venv

# On Windows:
.venv\Scripts\activate
# On Linux / macOS:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.template .env
# Edit .env and paste your GROQ_API_KEY

# Start FastAPI server on port 8001
python main.py
```

*Interactive API documentation is now live at [http://localhost:8001/docs](http://localhost:8001/docs).*

#### 3. Frontend Setup
```bash
# Open a new terminal in project root
cd ..

# Install NPM packages
npm install

# Configure environment
cp .env.example .env

# Start Vite development server
npm run dev
```

*Frontend web application is now live at [http://localhost:3000](http://localhost:3000).*

---

## 🔑 Pre-Configured Demo Accounts

For immediate testing, seed accounts are provided in the authentication system:

| Persona | Email | Password | Allowed Access |
|---|---|---|---|
| **Recruiter / Hiring Manager** | `recruiter@aiinterviewagent.com` | `Recruiter123!` | `/dashboard`, `/reports`, Pipeline, Settings |
| **Candidate** | `candidate@aiinterviewagent.com` | `Candidate123!` | `/interview` (Live Assessment Room) |
| **System Admin** | `admin@aiinterviewagent.com` | `Admin123!` | Full System & Telemetry Access |

---

## 📂 Project Directory Structure

```
AI-Interview-Agent/
├── backend/                        # FastAPI AI Service
│   ├── data/                       # Local persistent JSON fallbacks
│   │   ├── candidates.json
│   │   ├── email_logs.json
│   │   └── job_descriptions.json
│   ├── db/                         # MongoDB & data schemas
│   │   ├── models.py
│   │   └── mongo_client.py
│   ├── langgraph_agents/           # AI Conductor & LangGraph nodes
│   │   ├── interview_conductor_agent.py
│   │   └── tts_agent.py
│   ├── repositories/               # Data access layer
│   │   ├── candidate_repository.py
│   │   ├── email_repository.py
│   │   └── user_repository.py
│   ├── services/                   # Business logic & scoring engines
│   │   ├── candidate_service.py
│   │   └── email_service.py
│   ├── app.py                      # Flask auxiliary service
│   ├── main.py                     # FastAPI entrypoint (Port 8001)
│   ├── requirements.txt            # Python dependencies
│   └── .env.template               # Backend environment template
├── public/                         # Static assets
│   ├── favicon.svg                 # Vector circular brand logo
│   └── favicon.ico                 # Multi-resolution favicon
├── src/                            # Frontend React + TypeScript
│   ├── components/                 # Atomic UI components (shadcn/radix)
│   │   └── ui/
│   │       ├── login.tsx           # Authentication portal
│   │       └── ...
│   ├── components1/                # Core platform views
│   │   ├── RecruiterDashboard.tsx  # Recruiter workspace & analytics
│   │   ├── VideoInterview.tsx      # Candidate video interview room
│   │   ├── Sidebar.tsx             # Recruiter navigation bar
│   │   └── InterviewLayout.tsx     # Assessment room layout
│   ├── context/                    # React Contexts (Auth, Candidates, Theme)
│   ├── services/                   # Frontend API connectors
│   ├── App.tsx                     # Route definitions & guards
│   └── index.css                   # Stitch UI theme & design tokens
├── .env.example                    # Frontend environment template
├── .gitignore                      # Secure git ignore specification
├── index.html                      # HTML5 entrypoint with brand meta
├── package.json                    # Node dependencies & build scripts
├── start_demo.ps1                  # Single-command demonstration script
└── vite.config.ts                  # Vite build & proxy configuration
```

---

## 🧪 Testing & Verification

Run tests and type checks across the codebase:

```bash
# Frontend TypeScript check
npx tsc --noEmit

# Frontend Production Bundle build
npm run build

# Backend Test Suite
cd backend
python -m unittest discover -s tests
```

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

1. Fork the repository (`https://github.com/ashishyadav024/AI-Interview-Agent/fork`)
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'feat: Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the **MIT License**. See `LICENSE` for more information.

---

<p align="center">
  <b>AI Interview Agent</b> • Built with ❤️ for intelligent, fair, and frictionless hiring.
</p>
