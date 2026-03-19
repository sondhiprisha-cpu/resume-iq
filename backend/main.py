from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import io
import re

app = FastAPI(title="ResumeIQ API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AnalyzeRequest(BaseModel):
    resume_text: str
    job_description: str

class ParsedResume(BaseModel):
    name: str
    email: str
    phone: str
    skills: list[str]
    education: list[str]
    experience: list[str]
    projects: list[str]
    certifications: list[str]
    sections_found: dict

class AnalysisResult(BaseModel):
    match_score: float
    found_skills: list[str]
    missing_skills: list[str]
    section_scores: dict
    parsed_resume: ParsedResume
    suggestions: list[str]
    strengths: list[str]

_nlp = None
_model = None

def get_nlp():
    global _nlp
    if _nlp is None:
        import spacy
        try:
            _nlp = spacy.load("en_core_web_sm")
        except OSError:
            import subprocess
            subprocess.run(["python", "-m", "spacy", "download", "en_core_web_sm"], check=True)
            _nlp = spacy.load("en_core_web_sm")
    return _nlp

def get_model():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model

def extract_text_from_pdf(file_bytes: bytes) -> str:
    text = ""
    try:
        import pdfplumber
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
        if text.strip():
            print(f"pdfplumber extracted {len(text)} characters")
            return text.strip()
        raise Exception("pdfplumber returned empty text")
    except Exception as e:
        print(f"pdfplumber failed: {e}, trying PyPDF2...")
    try:
        import PyPDF2
        reader = PyPDF2.PdfReader(io.BytesIO(file_bytes))
        for page in reader.pages:
            extracted = page.extract_text()
            if extracted:
                text += extracted + "\n"
        if text.strip():
            print(f"PyPDF2 extracted {len(text)} characters")
            return text.strip()
    except Exception as e:
        print(f"PyPDF2 also failed: {e}")
    return ""

def extract_text_from_docx(file_bytes: bytes) -> str:
    from docx import Document
    doc = Document(io.BytesIO(file_bytes))
    return "\n".join([para.text for para in doc.paragraphs if para.text.strip()])

SKILL_KEYWORDS = [
    "python", "java", "javascript", "typescript", "c++", "c#", "go", "rust", "kotlin", "swift",
    "react", "angular", "vue", "nextjs", "nodejs", "fastapi", "flask", "django", "spring",
    "machine learning", "deep learning", "nlp", "computer vision", "llm", "generative ai",
    "tensorflow", "pytorch", "keras", "scikit-learn", "huggingface", "transformers", "langchain",
    "sql", "postgresql", "mysql", "mongodb", "redis", "elasticsearch", "cassandra",
    "aws", "gcp", "azure", "docker", "kubernetes", "terraform", "ci/cd", "github actions",
    "spark", "kafka", "airflow", "dbt", "pandas", "numpy", "matplotlib", "plotly",
    "git", "linux", "bash", "rest api", "graphql", "microservices", "mlops", "mlflow",
    "faiss", "pinecone", "weaviate", "rag", "fine-tuning", "bert", "gpt", "mistral", "llama",
]

SECTION_HEADERS = {
    "education": ["education", "academic", "qualification", "degree", "university", "college"],
    "experience": ["experience", "employment", "work history", "professional", "career"],
    "skills": ["skills", "technical skills", "technologies", "competencies", "expertise"],
    "projects": ["projects", "portfolio", "work samples", "personal projects"],
    "certifications": ["certifications", "certificates", "awards", "achievements", "licenses"],
}

def extract_email(text: str) -> str:
    match = re.search(r"[\w\.-]+@[\w\.-]+\.\w+", text)
    return match.group(0) if match else ""

def extract_phone(text: str) -> str:
    match = re.search(r"(\+?\d[\d\s\-().]{7,}\d)", text)
    return match.group(0).strip() if match else ""

def extract_name(text: str) -> str:
    nlp = get_nlp()
    doc = nlp(text[:300])
    for ent in doc.ents:
        if ent.label_ == "PERSON":
            return ent.text
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    return lines[0] if lines else "Unknown"

def extract_skills_from_text(text: str) -> list[str]:
    text_lower = text.lower()
    found = []
    for skill in SKILL_KEYWORDS:
        pattern = r"\b" + re.escape(skill) + r"\b"
        if re.search(pattern, text_lower):
            found.append(skill.title() if len(skill.split()) == 1 else skill.upper() if len(skill) <= 4 else skill.title())
    return list(dict.fromkeys(found))

def detect_sections(text: str) -> dict:
    text_lower = text.lower()
    detected = {}
    for section, keywords in SECTION_HEADERS.items():
        detected[f"has_{section}"] = any(kw in text_lower for kw in keywords)
    return detected

def extract_section_content(text: str, section: str) -> list[str]:
    keywords = SECTION_HEADERS.get(section, [])
    lines = text.split("\n")
    in_section = False
    content = []
    for line in lines:
        line_lower = line.lower().strip()
        if any(kw in line_lower for kw in keywords) and len(line.strip()) < 40:
            in_section = True
            continue
        if in_section:
            is_new_section = any(
                any(kw in line_lower for kw in kws)
                for sec, kws in SECTION_HEADERS.items()
                if sec != section and len(line.strip()) < 40
            )
            if is_new_section:
                break
            if line.strip():
                content.append(line.strip())
    return content[:8]

def parse_resume(text: str) -> ParsedResume:
    return ParsedResume(
        name=extract_name(text),
        email=extract_email(text),
        phone=extract_phone(text),
        skills=extract_skills_from_text(text),
        education=extract_section_content(text, "education"),
        experience=extract_section_content(text, "experience"),
        projects=extract_section_content(text, "projects"),
        certifications=extract_section_content(text, "certifications"),
        sections_found=detect_sections(text),
    )

def compute_match_score(resume_text: str, jd_text: str) -> float:
    from sklearn.metrics.pairwise import cosine_similarity
    import numpy as np
    model = get_model()
    embeddings = model.encode([resume_text, jd_text])
    score = cosine_similarity([embeddings[0]], [embeddings[1]])[0][0]
    scaled = float(np.clip((score - 0.2) / 0.7 * 100, 0, 100))
    return round(scaled, 1)

def compute_skill_gap(resume_text: str, jd_text: str):
    resume_skills = set(s.lower() for s in extract_skills_from_text(resume_text))
    jd_skills = set(s.lower() for s in extract_skills_from_text(jd_text))
    found = [s for s in jd_skills if s in resume_skills]
    missing = [s for s in jd_skills if s not in resume_skills]
    fmt = lambda lst: [s.title() if len(s.split()) == 1 else s.upper() if len(s) <= 4 else s.title() for s in lst]
    return fmt(found), fmt(missing)

def compute_section_scores(parsed: ParsedResume, match_score: float) -> dict:
    return {
        "skills": min(100, len(parsed.skills) * 8),
        "experience": min(100, len(parsed.experience) * 12),
        "education": 85 if parsed.sections_found.get("has_education") else 30,
        "projects": min(100, len(parsed.projects) * 20),
    }

def generate_suggestions(parsed: ParsedResume, missing_skills: list[str], match_score: float) -> list[str]:
    suggestions = []
    if missing_skills:
        suggestions.append(f"Add missing skills to your Skills section: {', '.join(missing_skills[:4])}")
    if len(parsed.experience) < 3:
        suggestions.append("Expand work experience with bullet points using the STAR method (Situation, Task, Action, Result)")
    if not any("%" in e or any(c.isdigit() for c in e) for e in parsed.experience):
        suggestions.append("Quantify achievements with numbers (e.g. 'Improved model accuracy by 15%')")
    if not parsed.sections_found.get("has_projects"):
        suggestions.append("Add a Projects section showcasing relevant AI/ML projects with GitHub links")
    if not parsed.certifications:
        suggestions.append("Add certifications (AWS, Google Cloud, Coursera ML) to strengthen your profile")
    if match_score < 60:
        suggestions.append("Tailor your resume summary to mirror keywords from the job description")
    return suggestions[:5]

def identify_strengths(parsed: ParsedResume, found_skills: list[str]) -> list[str]:
    strengths = []
    if len(found_skills) >= 5:
        strengths.append(f"Strong skill alignment — {len(found_skills)} matching skills found")
    if parsed.sections_found.get("has_projects"):
        strengths.append("Portfolio projects demonstrate practical experience")
    if parsed.certifications:
        strengths.append("Certifications validate technical expertise")
    if len(parsed.experience) >= 3:
        strengths.append("Well-documented work experience")
    if parsed.sections_found.get("has_education"):
        strengths.append("Educational background clearly presented")
    return strengths[:4]

@app.get("/health")
def health():
    return {"status": "ok", "version": "1.0.0"}

@app.post("/extract-text")
async def extract_text(file: UploadFile = File(...)):
    content = await file.read()
    filename = file.filename.lower()
    print(f"Received file: {filename}, size: {len(content)} bytes")
    try:
        if filename.endswith(".pdf"):
            text = extract_text_from_pdf(content)
        elif filename.endswith(".docx"):
            text = extract_text_from_docx(content)
        elif filename.endswith(".txt"):
            text = content.decode("utf-8", errors="ignore")
        else:
            raise HTTPException(status_code=400, detail="Unsupported file type. Use PDF, DOCX, or TXT.")
        print(f"Total extracted: {len(text)} characters")
        if not text.strip():
            raise HTTPException(status_code=422, detail="Could not extract text. PDF may be image-based.")
        return {"text": text, "filename": file.filename, "char_count": len(text)}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Extraction error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/parse-resume")
async def parse_resume_endpoint(file: UploadFile = File(...)):
    content = await file.read()
    filename = file.filename.lower()
    if filename.endswith(".pdf"):
        text = extract_text_from_pdf(content)
    elif filename.endswith(".docx"):
        text = extract_text_from_docx(content)
    else:
        text = content.decode("utf-8", errors="ignore")
    parsed = parse_resume(text)
    return {"raw_text": text, "parsed": parsed}

@app.post("/analyze", response_model=AnalysisResult)
def analyze(req: AnalyzeRequest):
    parsed = parse_resume(req.resume_text)
    match_score = compute_match_score(req.resume_text, req.job_description)
    found_skills, missing_skills = compute_skill_gap(req.resume_text, req.job_description)
    section_scores = compute_section_scores(parsed, match_score)
    suggestions = generate_suggestions(parsed, missing_skills, match_score)
    strengths = identify_strengths(parsed, found_skills)
    return AnalysisResult(
        match_score=match_score,
        found_skills=found_skills,
        missing_skills=missing_skills,
        section_scores=section_scores,
        parsed_resume=parsed,
        suggestions=suggestions,
        strengths=strengths,
    )

@app.post("/rank-resumes")
async def rank_resumes(files: list[UploadFile] = File(...), job_description: str = ""):
    from sklearn.metrics.pairwise import cosine_similarity
    model = get_model()
    jd_embedding = model.encode([job_description])
    results = []
    for file in files:
        content = await file.read()
        filename = file.filename.lower()
        if filename.endswith(".pdf"):
            text = extract_text_from_pdf(content)
        elif filename.endswith(".docx"):
            text = extract_text_from_docx(content)
        else:
            text = content.decode("utf-8", errors="ignore")
        parsed = parse_resume(text)
        resume_embedding = model.encode([text])
        score = float(cosine_similarity(resume_embedding, jd_embedding)[0][0])
        scaled = round(max(0, min(100, (score - 0.2) / 0.7 * 100)), 1)
        results.append({
            "filename": file.filename,
            "name": parsed.name,
            "email": parsed.email,
            "score": scaled,
            "skills_found": len(parsed.skills),
            "top_skills": parsed.skills[:5]
        })
    results.sort(key=lambda x: x["score"], reverse=True)
    for i, r in enumerate(results):
        r["rank"] = i + 1
    return {"rankings": results, "total": len(results)}