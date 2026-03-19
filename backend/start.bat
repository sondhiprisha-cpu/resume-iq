@echo off
echo ========================================
echo      ResumeIQ Backend Startup
echo ========================================
echo.

:: Check if venv exists, create if not
IF NOT EXIST "venv\" (
    echo [1/4] Creating virtual environment...
    python -m venv venv
    echo Done.
) ELSE (
    echo [1/4] Virtual environment found.
)

:: Activate venv
echo [2/4] Activating virtual environment...
call venv\Scripts\activate

:: Install dependencies
echo [3/4] Installing dependencies (first run takes a few minutes)...
pip install -r requirements.txt --quiet

:: Download spaCy model if not present
echo [4/4] Checking spaCy model...
python -c "import spacy; spacy.load('en_core_web_sm')" 2>nul || python -m spacy download en_core_web_sm

:: Start server
echo.
echo ========================================
echo  Backend running at http://localhost:8000
echo  API docs at   http://localhost:8000/docs
echo  Press Ctrl+C to stop
echo ========================================
echo.
uvicorn main:app --reload --port 8000
pause
