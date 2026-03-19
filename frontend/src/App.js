import { useState, useRef } from "react";

const BACKEND_URL = "http://localhost:8000";

const parseJSON = (text) => {
  try { return JSON.parse(text.replace(/```json|```/g, "").trim()); }
  catch { return null; }
};

const ScoreRing = ({ score }) => {
  const r = 54, circ = 2 * Math.PI * r;
  const color = score >= 75 ? "#00ff88" : score >= 50 ? "#ffd700" : "#ff4444";
  return (
    <div style={{ position: "relative", width: 130, height: 130 }}>
      <svg width="130" height="130" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="65" cy="65" r={r} fill="none" stroke="#1a2a1a" strokeWidth="10" />
        <circle cx="65" cy="65" r={r} fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={`${(score / 100) * circ} ${circ}`} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 1.2s cubic-bezier(0.4,0,0.2,1)", filter: `drop-shadow(0 0 8px ${color})` }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: "28px", fontWeight: "800", color, fontFamily: "'Space Mono', monospace" }}>{score}%</div>
        <div style={{ fontSize: "10px", color: "#666", letterSpacing: "0.1em", textTransform: "uppercase" }}>match</div>
      </div>
    </div>
  );
};

const SkillBadge = ({ skill, found }) => (
  <span style={{
    display: "inline-block", padding: "4px 12px", borderRadius: "20px", fontSize: "12px",
    fontWeight: "600", margin: "3px", fontFamily: "'Space Mono', monospace",
    background: found ? "rgba(0,255,136,0.1)" : "rgba(255,68,68,0.1)",
    color: found ? "#00ff88" : "#ff6666",
    border: `1px solid ${found ? "rgba(0,255,136,0.3)" : "rgba(255,68,68,0.3)"}`,
  }}>{found ? "✓ " : "✗ "}{skill}</span>
);

const Loader = ({ text }) => (
  <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "#00ff88", fontSize: "13px" }}>
    <div style={{ width: "16px", height: "16px", border: "2px solid rgba(0,255,136,0.2)", borderTop: "2px solid #00ff88", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
    {text}
  </div>
);

const Section = ({ title, children, accent = "#00ff88" }) => (
  <div style={{ marginBottom: "24px" }}>
    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
      <div style={{ width: "3px", height: "18px", background: accent, borderRadius: "2px" }} />
      <h3 style={{ margin: 0, fontSize: "13px", fontWeight: "700", letterSpacing: "0.12em", textTransform: "uppercase", color: "#aaa" }}>{title}</h3>
    </div>
    {children}
  </div>
);

const StatusDot = ({ online }) => (
  <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: online ? "#00ff88" : "#ff6666" }}>
    <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: online ? "#00ff88" : "#ff6666", boxShadow: online ? "0 0 6px #00ff88" : "none" }} />
    {online ? "Backend connected" : "Backend offline"}
  </div>
);

export default function App() {
  const [backendOnline, setBackendOnline] = useState(null);
  const [resumeText, setResumeText] = useState("");
  const [fileName, setFileName] = useState("");
  const [jdText, setJdText] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [activeTab, setActiveTab] = useState("analyzer");
  const [showConfig, setShowConfig] = useState(false);
  const [configInput, setConfigInput] = useState(BACKEND_URL);
  const [customUrl, setCustomUrl] = useState(BACKEND_URL);
  const fileRef = useRef();

  const checkBackend = async (url) => {
    try {
      const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(3000) });
      setBackendOnline(res.ok);
      return res.ok;
    } catch {
      setBackendOnline(false);
      return false;
    }
  };

  const handleFile = async (file) => {
    if (!file) return;
    setFileName(file.name);
    setLoadingStep("Extracting text from file...");
    setLoading(true);
    const online = await checkBackend(customUrl);
    if (online) {
      try {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch(`${customUrl}/extract-text`, { method: "POST", body: form });
        const data = await res.json();
        if (data.text && data.text.trim().length > 0) {
          setResumeText(data.text);
          setLoadingStep("✓ File extracted successfully!");
          setTimeout(() => setLoadingStep(""), 2000);
        } else {
          setResumeText("");
          setLoadingStep("⚠ This PDF is image-based. Please paste your resume text below.");
          setTimeout(() => setLoadingStep(""), 6000);
        }
      } catch (err) {
        console.error("File extraction error:", err);
        setLoadingStep("⚠ Extraction failed. Please paste your resume text below.");
        setTimeout(() => setLoadingStep(""), 6000);
      }
    } else {
      if (file.type === "text/plain") {
        const reader = new FileReader();
        reader.onload = (e) => setResumeText(e.target.result || "");
        reader.readAsText(file);
      } else {
        setLoadingStep("⚠ Backend offline. Please paste your resume text below.");
        setTimeout(() => setLoadingStep(""), 6000);
        setResumeText("");
      }
    }
    setLoading(false);
  };

  const analyze = async () => {
    if (!resumeText || !jdText) return;
    setLoading(true);
    setResults(null);
    setLoadingStep("Running NLP parsing & semantic embedding analysis...");
    const online = await checkBackend(customUrl);

    if (online) {
      try {
        const res = await fetch(`${customUrl}/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resume_text: resumeText, job_description: jdText }),
        });
        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Server error ${res.status}: ${errText}`);
        }
        const data = await res.json();
        setResults({
          matchScore: Math.round(data.match_score),
          foundSkills: data.found_skills || [],
          missingSkills: data.missing_skills || [],
          sectionScores: data.section_scores || {},
          name: data.parsed_resume?.name || "",
          email: data.parsed_resume?.email || "",
          education: data.parsed_resume?.education?.join(" | ") || "",
          suggestions: data.suggestions || [],
          strengths: data.strengths || [],
          source: "backend",
        });
      } catch (err) {
        console.error("Analyze error:", err);
        setResults({ error: `Backend error: ${err.message}` });
      }
    } else {
      setResults({ error: "Backend is offline. Please start the backend and try again." });
    }
    setLoading(false);
    setLoadingStep("");
  };

  const sampleJD = `Senior Machine Learning Engineer\n\nRequired Skills:\n- Python (Expert)\n- Machine Learning, Deep Learning, NLP\n- LLMs, HuggingFace Transformers\n- TensorFlow or PyTorch\n- Docker, Kubernetes\n- AWS or GCP\n- MLflow / MLOps\n- SQL, Apache Spark\n- FAISS or vector databases\n\nResponsibilities:\n- Build and deploy ML models at scale\n- Design NLP pipelines\n- Manage cloud-based model deployments\n- Fine-tune LLMs for production use`;

  return (
    <div style={{ minHeight: "100vh", background: "#0a0f0a", color: "#e0e0e0", fontFamily: "'Sora','Segoe UI',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600;700;800&family=Space+Mono:wght@400;700&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: #0a0f0a; } ::-webkit-scrollbar-thumb { background: #1e2e1e; }
        textarea, input { outline: none !important; font-family: 'Space Mono', monospace; }
        .tab { background: none; border: none; cursor: pointer; padding: 10px 20px; font-family: 'Sora',sans-serif; font-size: 13px; font-weight: 600; letter-spacing: 0.05em; transition: all 0.2s; }
        .tab.active { color: #00ff88; border-bottom: 2px solid #00ff88; }
        .tab:not(.active) { color: #555; border-bottom: 2px solid transparent; }
        .tab:hover:not(.active) { color: #888; }
        .btn { background: #00ff88; color: #000; border: none; padding: 14px 40px; border-radius: 8px; font-family: 'Sora',sans-serif; font-weight: 700; font-size: 14px; cursor: pointer; letter-spacing: 0.05em; transition: all 0.2s; }
        .btn:hover:not(:disabled) { background: #00cc6a; transform: translateY(-1px); box-shadow: 0 8px 24px rgba(0,255,136,0.25); }
        .btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 24px; }
        .drop-zone { border: 2px dashed #2a3a2a; border-radius: 12px; padding: 28px; text-align: center; cursor: pointer; background: rgba(0,0,0,0.2); transition: all 0.2s; }
        .drop-zone:hover { border-color: #00ff88; background: rgba(0,255,136,0.04); }
      `}</style>

      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "0 32px" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: "64px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ width: "8px", height: "8px", background: "#00ff88", borderRadius: "50%", boxShadow: "0 0 12px #00ff88" }} />
            <span style={{ fontWeight: "800", fontSize: "16px", letterSpacing: "0.05em" }}>RESUMEIQ</span>
            <span style={{ fontSize: "10px", background: "rgba(0,255,136,0.1)", color: "#00ff88", padding: "2px 8px", borderRadius: "4px", fontFamily: "'Space Mono'", border: "1px solid rgba(0,255,136,0.2)" }}>AI POWERED</span>
            {backendOnline !== null && <StatusDot online={backendOnline} />}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <nav style={{ display: "flex" }}>
              {["analyzer", "how it works"].map(t => (
                <button key={t} className={`tab ${activeTab === t ? "active" : ""}`} onClick={() => setActiveTab(t)}>{t.toUpperCase()}</button>
              ))}
            </nav>
            <button onClick={() => setShowConfig(!showConfig)} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#888", padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "11px", fontFamily: "'Space Mono'" }}>
              ⚙ CONFIG
            </button>
          </div>
        </div>
      </div>

      {showConfig && (
        <div style={{ background: "#0d150d", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "16px 32px" }}>
          <div style={{ maxWidth: "1200px", margin: "0 auto", display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "12px", color: "#666", minWidth: "100px" }}>Backend URL:</span>
            <input value={configInput} onChange={(e) => setConfigInput(e.target.value)}
              style={{ flex: 1, background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.1)", color: "#ccc", padding: "8px 12px", borderRadius: "6px", fontSize: "13px" }}
              placeholder="http://localhost:8000" />
            <button onClick={async () => { setCustomUrl(configInput); await checkBackend(configInput); setShowConfig(false); }}
              style={{ background: "#00ff88", color: "#000", border: "none", padding: "8px 20px", borderRadius: "6px", cursor: "pointer", fontWeight: "700", fontSize: "13px", fontFamily: "'Sora',sans-serif" }}>
              Connect
            </button>
            <button onClick={() => checkBackend(customUrl)}
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#888", padding: "8px 16px", borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontFamily: "'Sora',sans-serif" }}>
              Test
            </button>
          </div>
        </div>
      )}

      {activeTab === "how it works" ? (
        <div style={{ maxWidth: "800px", margin: "48px auto", padding: "0 32px", animation: "fadeIn 0.4s ease" }}>
          <h2 style={{ fontSize: "28px", fontWeight: "800", marginBottom: "8px" }}>System Architecture</h2>
          <p style={{ color: "#555", marginBottom: "32px", fontSize: "14px" }}>FastAPI + spaCy + SentenceTransformers + Claude LLM</p>
          {[
            { step: "01", title: "File Upload → /extract-text", desc: "PDF files processed by pdfplumber, DOCX by python-docx. Image-based PDFs fall back to manual paste.", tech: "pdfplumber · PyPDF2 · python-docx · FastAPI" },
            { step: "02", title: "NLP Parsing → spaCy", desc: "spaCy en_core_web_sm detects named entities and splits resume into sections.", tech: "spaCy en_core_web_sm · regex · NER" },
            { step: "03", title: "Semantic Embeddings", desc: "SentenceTransformer encodes resume and JD into 384-dim vectors.", tech: "all-MiniLM-L6-v2 · SentenceTransformers" },
            { step: "04", title: "Match Score", desc: "Cosine similarity between resume and JD embeddings scaled to 0-100%.", tech: "scikit-learn · cosine_similarity" },
            { step: "05", title: "Skill Gap Analysis", desc: "60+ tech skills taxonomy. Set difference finds missing skills.", tech: "custom skill taxonomy · set operations" },
            { step: "06", title: "LLM Suggestions", desc: "Backend generates smart suggestions based on skill gaps and experience analysis.", tech: "FastAPI · rule-based NLP · skill taxonomy" },
          ].map(({ step, title, desc, tech }) => (
            <div key={step} className="card" style={{ marginBottom: "16px", display: "flex", gap: "20px" }}>
              <div style={{ fontFamily: "'Space Mono'", fontSize: "11px", color: "#00ff88", fontWeight: "700", minWidth: "28px", paddingTop: "2px" }}>{step}</div>
              <div>
                <div style={{ fontWeight: "700", fontSize: "15px", marginBottom: "6px" }}>{title}</div>
                <div style={{ color: "#888", fontSize: "13px", lineHeight: "1.6", marginBottom: "8px" }}>{desc}</div>
                <div style={{ fontFamily: "'Space Mono'", fontSize: "11px", color: "#555", background: "rgba(0,0,0,0.4)", padding: "4px 10px", borderRadius: "4px", display: "inline-block" }}>{tech}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "32px" }}>
          <div style={{ textAlign: "center", marginBottom: "36px" }}>
            <h1 style={{ fontSize: "40px", fontWeight: "800", margin: "0 0 10px", lineHeight: 1.1 }}>
              Analyze Your Resume with <span style={{ color: "#00ff88" }}>AI</span>
            </h1>
            <p style={{ color: "#555", fontSize: "14px", maxWidth: "500px", margin: "0 auto" }}>
              Real semantic embeddings · spaCy NLP · Claude LLM suggestions
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginBottom: "24px" }}>
            <div className="card">
              <Section title="Resume Upload">
                <div className="drop-zone"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
                  onClick={() => fileRef.current.click()}>
                  <input ref={fileRef} type="file" accept=".pdf,.docx,.txt" style={{ display: "none" }} onChange={(e) => handleFile(e.target.files[0])} />
                  <div style={{ fontSize: "28px", marginBottom: "6px" }}>📄</div>
                  {fileName
                    ? <div style={{ color: "#00ff88", fontSize: "13px", fontWeight: "600" }}>{fileName} <span style={{ color: "#555", fontWeight: "400" }}>— click to replace</span></div>
                    : <div style={{ color: "#555", fontSize: "13px" }}>Drop PDF/DOCX here or click to upload</div>}
                </div>
                {loadingStep && !loading && (
                  <div style={{ marginTop: "10px", fontSize: "12px", color: loadingStep.includes("⚠") ? "#ffd700" : "#00ff88", fontFamily: "'Space Mono'", lineHeight: "1.5" }}>
                    {loadingStep}
                  </div>
                )}
                <div style={{ margin: "10px 0", textAlign: "center", color: "#333", fontSize: "11px" }}>— or paste below —</div>
                <textarea value={resumeText} onChange={(e) => setResumeText(e.target.value)}
                  placeholder="Paste resume text..."
                  style={{ width: "100%", height: "160px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "8px", padding: "12px", color: "#ccc", fontSize: "12px", resize: "vertical", lineHeight: "1.6" }} />
                {resumeText.length > 0 && (
                  <div style={{ fontSize: "11px", color: "#00ff88", marginTop: "6px", fontFamily: "'Space Mono'" }}>
                    ✓ {resumeText.length} characters loaded
                  </div>
                )}
              </Section>
            </div>

            <div className="card">
              <Section title="Job Description">
                <textarea value={jdText} onChange={(e) => setJdText(e.target.value)}
                  placeholder="Paste job description..."
                  style={{ width: "100%", height: "300px", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "8px", padding: "12px", color: "#ccc", fontSize: "12px", resize: "vertical", lineHeight: "1.6" }} />
                <button onClick={() => setJdText(sampleJD)} style={{ background: "none", border: "1px solid rgba(255,255,255,0.08)", color: "#555", padding: "6px 14px", borderRadius: "6px", cursor: "pointer", fontSize: "12px", marginTop: "8px", fontFamily: "'Sora',sans-serif" }}>
                  Load sample JD →
                </button>
              </Section>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "14px", marginBottom: "32px" }}>
            <button className="btn" onClick={analyze} disabled={loading || !resumeText || !jdText}>
              {loading ? "Analyzing..." : "⚡ Analyze Resume"}
            </button>
            {loading && <Loader text={loadingStep} />}
          </div>

          {results && !results.error && (
            <div style={{ animation: "fadeIn 0.5s ease" }}>
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "12px" }}>
                <span style={{ fontSize: "11px", fontFamily: "'Space Mono'", color: "#00ff88", background: "rgba(0,255,136,0.08)", padding: "3px 10px", borderRadius: "4px", border: "1px solid rgba(0,255,136,0.2)" }}>
                  ⚙ FastAPI + spaCy + SentenceTransformers
                </span>
              </div>

              <div className="card" style={{ display: "flex", alignItems: "center", gap: "32px", marginBottom: "24px", background: "rgba(0,255,136,0.02)", borderColor: "rgba(0,255,136,0.12)" }}>
                <ScoreRing score={results.matchScore || 0} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "11px", color: "#555", marginBottom: "6px", letterSpacing: "0.1em", textTransform: "uppercase" }}>Overall Match Score</div>
                  <div style={{ fontSize: "22px", fontWeight: "800", marginBottom: "4px" }}>{results.name || "Candidate"}</div>
                  <div style={{ fontSize: "13px", color: "#555" }}>{results.email}</div>
                  {results.education && <div style={{ fontSize: "12px", color: "#444", marginTop: "4px" }}>🎓 {results.education}</div>}
                </div>
                {results.sectionScores && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    {Object.entries(results.sectionScores).map(([k, v]) => (
                      <div key={k} style={{ textAlign: "center" }}>
                        <div style={{ fontSize: "20px", fontWeight: "800", fontFamily: "'Space Mono'", color: v >= 70 ? "#00ff88" : v >= 50 ? "#ffd700" : "#ff6666" }}>{v}%</div>
                        <div style={{ fontSize: "10px", color: "#444", textTransform: "capitalize", letterSpacing: "0.08em" }}>{k}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
                <div className="card">
                  <Section title="Skills Found" accent="#00ff88">
                    {results.foundSkills && results.foundSkills.length > 0
                      ? <div>{results.foundSkills.map(s => <SkillBadge key={s} skill={s} found />)}</div>
                      : <div style={{ fontSize: "13px", color: "#555", fontStyle: "italic" }}>No matching skills found — try adding more keywords to your resume.</div>
                    }
                  </Section>
                  <Section title="Missing Skills" accent="#ff4444">
                    {results.missingSkills && results.missingSkills.length > 0
                      ? <div>{results.missingSkills.map(s => <SkillBadge key={s} skill={s} found={false} />)}</div>
                      : <div style={{ fontSize: "13px", color: "#555", fontStyle: "italic" }}>No missing skills detected.</div>
                    }
                  </Section>
                </div>
                <div className="card">
                  <Section title="AI Improvement Suggestions" accent="#ffd700">
                    {results.suggestions && results.suggestions.length > 0 ? (
                      results.suggestions.map((s, i) => (
                        <div key={i} style={{ display: "flex", gap: "12px", marginBottom: "10px", padding: "12px", background: "rgba(255,215,0,0.03)", borderRadius: "8px", border: "1px solid rgba(255,215,0,0.08)" }}>
                          <div style={{ fontFamily: "'Space Mono'", fontSize: "11px", color: "#ffd700", fontWeight: "700", minWidth: "20px" }}>0{i + 1}</div>
                          <div style={{ fontSize: "13px", color: "#bbb", lineHeight: "1.5" }}>{s}</div>
                        </div>
                      ))
                    ) : (
                      <div style={{ fontSize: "13px", color: "#555", fontStyle: "italic" }}>No suggestions generated.</div>
                    )}
                  </Section>
                </div>
              </div>

              {results.strengths?.length > 0 && (
                <div className="card" style={{ marginTop: "24px" }}>
                  <Section title="Key Strengths">
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      {results.strengths.map((s, i) => (
                        <div key={i} style={{ padding: "8px 16px", background: "rgba(0,255,136,0.05)", border: "1px solid rgba(0,255,136,0.12)", borderRadius: "8px", fontSize: "13px", color: "#ccc" }}>✦ {s}</div>
                      ))}
                    </div>
                  </Section>
                </div>
              )}

              <div style={{ marginTop: "24px", textAlign: "center", padding: "20px", background: "rgba(0,0,0,0.3)", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.04)" }}>
                <div style={{ fontSize: "11px", color: "#444", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "8px" }}>Recommendation</div>
                <div style={{ fontSize: "14px", color: "#aaa", maxWidth: "600px", margin: "0 auto", lineHeight: "1.6" }}>
                  {(results.matchScore || 0) >= 75 ? "🟢 Strong match — address the missing skills and this resume is highly competitive."
                    : (results.matchScore || 0) >= 55 ? "🟡 Moderate match — significant gaps exist. Apply the suggestions above."
                    : "🔴 Weak match — tailor this resume more specifically to the role requirements."}
                </div>
              </div>
            </div>
          )}

          {results?.error && (
            <div style={{ textAlign: "center", color: "#ff6666", padding: "24px", background: "rgba(255,68,68,0.05)", borderRadius: "12px", border: "1px solid rgba(255,68,68,0.15)" }}>
              {results.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}