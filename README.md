# ResumeIQ — AI Resume Analyzer

Full-stack AI resume analyzer with FastAPI backend + React frontend.

## Project Structure

```
resumeiq/
├── backend/
│   ├── main.py           ← FastAPI server
│   ├── requirements.txt  ← Python dependencies
│   └── start.bat         ← Double-click to start (Windows)
└── frontend/
    ├── src/
    │   ├── App.js        ← Main React app
    │   └── index.js      ← Entry point
    ├── public/
    │   └── index.html
    ├── package.json
    └── start.bat         ← Double-click to start (Windows)
```

## Quick Start (Windows)

### Step 1 — Start Backend
1. Open the `backend/` folder
2. Double-click `start.bat`
3. Wait for: `Uvicorn running on http://127.0.0.1:8000`

### Step 2 — Start Frontend
1. Open the `frontend/` folder  
2. Double-click `start.bat`
3. Browser opens at http://localhost:3000

### Step 3 — Use the App
1. Click ⚙ CONFIG → URL should be `http://localhost:8000` → click Connect
2. Upload a resume (PDF/DOCX) or paste text
3. Paste a job description
4. Click Analyze Resume

## Manual Setup (VS Code Terminal)

```bash
# Terminal 1 — Backend
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python -m spacy download en_core_web_sm
uvicorn main:app --reload --port 8000

# Terminal 2 — Frontend
cd frontend
npm install
npm start
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI + Python |
| NLP | spaCy en_core_web_sm |
| Embeddings | SentenceTransformers all-MiniLM-L6-v2 |
| Similarity | scikit-learn cosine_similarity |
| PDF parsing | pdfplumber |
| DOCX parsing | python-docx |
| Frontend | React 18 |
| LLM | Claude Sonnet (suggestions) |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| /health | GET | Check if backend is running |
| /extract-text | POST | Upload PDF/DOCX → get text |
| /parse-resume | POST | Upload file → parsed sections |
| /analyze | POST | Text + JD → full analysis |
| /rank-resumes | POST | Multiple resumes → ranked list |

API docs: http://localhost:8000/docs
