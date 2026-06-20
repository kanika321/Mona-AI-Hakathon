import { useState, useRef } from "react";

/* =============================================================
   INTERVIEW COPILOT — interview support for a non-technical hirer
   Paste a job ad (or upload the PDF). The agent reads it and builds
   a tailored interview kit: role-specific questions, each explained
   in plain language, with what a strong answer sounds like and what
   to watch out for — plus overall red flags. Take notes live and it
   tallies a simple verdict.
   ============================================================= */

const GEMINI_KEY = "";
const MODEL = "gemini-2.5-flash-lite"; // switch to "gemini-2.5-flash" for richer kits

const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap');
:root{
  --ink:#171423;--ink-2:#221d33;--ink-3:#2f2848;--paper:#F2EFEA;--surface:#FFFFFF;--surface-2:#F8F6F2;
  --line:#E7E2DA;--line-strong:#D6CFC3;--text:#221E2B;--muted:#6E6678;--muted-2:#9C95A6;
  --accent:#5B4BDA;--accent-soft:#ECE9FB;--accent-ink:#43349e;
  --good:#1A8F55;--good-soft:#E4F4EC;--good-line:#C9E9D6;
  --bad:#CE3F3F;--bad-soft:#FBE7E7;--bad-line:#F0CFCF;
  --warn:#B5791C;--warn-soft:#F8EFDC;
}
*{box-sizing:border-box}
.rl-root{font-family:'Inter',system-ui,sans-serif;color:var(--text);background:var(--paper);min-height:100vh;display:flex;font-size:14px;line-height:1.5}
.rl-root button{font-family:inherit;cursor:pointer}
.mono{font-family:'JetBrains Mono',ui-monospace,monospace;font-variant-numeric:tabular-nums}
.rl-side{width:236px;flex:0 0 236px;background:var(--ink);color:#C4BDD0;display:flex;flex-direction:column;padding:22px 16px;position:sticky;top:0;height:100vh}
.rl-brand{display:flex;gap:11px;align-items:center;padding:0 6px}
.rl-mark{width:34px;height:34px;border-radius:9px;background:linear-gradient(140deg,var(--accent),#8273ee);display:grid;place-items:center;flex:0 0 34px;box-shadow:0 4px 14px rgba(91,75,218,.4)}
.rl-mark svg{width:18px;height:18px}
.rl-brand h1{font-family:'Space Grotesk';font-size:16.5px;font-weight:600;color:#fff;margin:0;letter-spacing:-.02em}
.rl-brand span{font-size:11px;color:var(--muted-2);display:block;margin-top:1px}
.side-note{margin-top:24px;font-size:12px;color:#A79FB4;line-height:1.55;padding:0 6px}
.side-note b{color:#E6E1EE;font-weight:600}
.side-steps{margin-top:18px;display:flex;flex-direction:column;gap:10px;padding:0 6px}
.sstep{display:flex;gap:10px;font-size:12px;color:#B4ADBF}
.sstep .n{width:20px;height:20px;border-radius:50%;background:var(--ink-3);color:#fff;display:grid;place-items:center;font-size:11px;font-weight:600;flex:0 0 20px}
.rl-agent{margin-top:auto;background:var(--ink-2);border:1px solid #2e273f;border-radius:11px;padding:12px}
.rl-agent .row{display:flex;align-items:center;gap:8px;font-size:12px;color:#d3cdde;font-weight:500}
.rl-dot{width:8px;height:8px;border-radius:50%;background:var(--accent);animation:pulse 2s infinite}
@keyframes pulse{0%{box-shadow:0 0 0 0 rgba(91,75,218,.5)}70%{box-shadow:0 0 0 7px rgba(91,75,218,0)}100%{box-shadow:0 0 0 0 rgba(91,75,218,0)}}
.rl-main{flex:1;min-width:0;display:flex;flex-direction:column}
.rl-body{flex:1;padding:0;overflow:auto}
.wrap{max-width:860px;margin:0 auto;padding:30px 26px 80px}
.intro h2{font-family:'Space Grotesk';font-size:24px;font-weight:600;letter-spacing:-.02em;margin:0 0 6px}
.intro p{color:var(--muted);font-size:14.5px;margin:0 0 22px;max-width:600px}
.inputcard{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:18px}
.inputcard textarea{width:100%;min-height:200px;border:1px solid var(--line-strong);border-radius:10px;padding:13px 14px;font-family:inherit;font-size:13.5px;line-height:1.5;resize:vertical;outline:none}
.inputcard textarea:focus{border-color:var(--accent)}
.inrow{display:flex;align-items:center;gap:10px;margin-top:13px;flex-wrap:wrap}
.btn{border:1px solid var(--line-strong);background:var(--surface);color:var(--text);padding:9px 15px;border-radius:9px;font-size:13px;font-weight:500;display:inline-flex;align-items:center;gap:7px;transition:.12s}
.btn:hover{border-color:var(--muted-2);background:var(--surface-2)}
.btn svg{width:15px;height:15px}
.btn-acc{background:var(--accent);border-color:var(--accent);color:#fff}
.btn-acc:hover{filter:brightness(.95);background:var(--accent)}
.btn-acc:disabled{opacity:.55;cursor:not-allowed}
.exlabel{font-size:12px;color:var(--muted);margin:22px 0 9px;font-weight:500}
.exrow{display:flex;gap:10px;flex-wrap:wrap}
.exchip{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:11px 13px;text-align:left;cursor:pointer;transition:.12s;flex:1;min-width:210px}
.exchip:hover{border-color:var(--accent);background:var(--accent-soft)}
.exchip .t{font-weight:600;font-size:13px}
.exchip .d{font-size:11.5px;color:var(--muted);margin-top:2px}
.err{margin-top:14px;background:var(--bad-soft);border:1px solid var(--bad-line);border-radius:10px;padding:11px 13px;font-size:13px;color:#9a3030}
.loading{text-align:center;padding:70px 20px}
.loading .ring{width:40px;height:40px;border:3px solid var(--line);border-top-color:var(--accent);border-radius:50%;margin:0 auto 16px;animation:sp .8s linear infinite}
@keyframes sp{to{transform:rotate(360deg)}}
.loading h4{font-family:'Space Grotesk';font-size:16px;margin:0 0 4px}
.loading p{color:var(--accent-ink);font-size:13px;margin:0;font-weight:500}
.kithead{display:flex;align-items:flex-start;gap:16px;margin-bottom:6px}
.kithead .k{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted-2);font-weight:600}
.kithead h2{font-family:'Space Grotesk';font-size:23px;font-weight:600;letter-spacing:-.02em;margin:3px 0 2px}
.kithead .co{font-size:13px;color:var(--muted)}
.seniority{font-size:11.5px;font-weight:600;color:var(--accent-ink);background:var(--accent-soft);border:1px solid #ddd6f8;padding:3px 10px;border-radius:20px;white-space:nowrap}
.summary{background:var(--surface);border:1px solid var(--line);border-radius:13px;padding:16px 18px;margin:14px 0 8px}
.summary .lab{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);font-weight:600;margin-bottom:6px}
.summary p{margin:0;font-size:14px;line-height:1.6}
.skills{display:flex;flex-wrap:wrap;gap:7px;margin:14px 0 4px}
.skill{font-size:12px;background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:4px 10px;color:var(--text)}
.sec{margin-top:26px}
.sec-h{font-family:'Space Grotesk';font-size:14px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--accent-ink);margin:0 0 12px;display:flex;align-items:center;gap:9px}
.sec-h .num{width:22px;height:22px;border-radius:6px;background:var(--accent-soft);color:var(--accent-ink);display:grid;place-items:center;font-size:12px}
.qcard{background:var(--surface);border:1px solid var(--line);border-radius:13px;padding:16px 18px;margin-bottom:13px}
.qcard .q{font-size:14.5px;font-weight:600;line-height:1.5}
.qcard .why{font-size:13px;color:var(--muted);margin-top:7px}
.qcard .why b{color:var(--text);font-weight:600}
.ga{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}
@media(max-width:620px){.ga{grid-template-columns:1fr}}
.flag{border-radius:10px;padding:10px 12px;font-size:12.5px;line-height:1.5}
.flag.good{background:var(--good-soft);border:1px solid var(--good-line)}
.flag.bad{background:var(--bad-soft);border:1px solid var(--bad-line)}
.flag .fl{display:flex;align-items:center;gap:6px;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px}
.flag.good .fl{color:var(--good)}.flag.bad .fl{color:var(--bad)}
.flag svg{width:14px;height:14px}
.verdict{display:flex;align-items:center;gap:8px;margin-top:13px;padding-top:13px;border-top:1px solid var(--line);flex-wrap:wrap}
.verdict .vl{font-size:12px;color:var(--muted);font-weight:500}
.vbtn{border:1px solid var(--line-strong);background:#fff;border-radius:8px;padding:5px 11px;font-size:12px;font-weight:600;color:var(--muted);display:inline-flex;align-items:center;gap:5px}
.vbtn:hover{border-color:var(--muted-2)}
.vbtn.on-good{background:var(--good-soft);border-color:var(--good-line);color:var(--good)}
.vbtn.on-ok{background:var(--warn-soft);border-color:#ecdcb6;color:var(--warn)}
.vbtn.on-bad{background:var(--bad-soft);border-color:var(--bad-line);color:var(--bad)}
.qnote{width:100%;margin-top:10px;border:1px solid var(--line);border-radius:8px;padding:8px 11px;font-family:inherit;font-size:13px;resize:vertical;min-height:38px;outline:none}
.qnote:focus{border-color:var(--accent)}
.redbox{background:var(--bad-soft);border:1px solid var(--bad-line);border-radius:13px;padding:16px 18px;margin-top:26px}
.redbox h3{font-family:'Space Grotesk';font-size:14px;margin:0 0 10px;color:var(--bad);display:flex;align-items:center;gap:8px}
.redbox svg{width:16px;height:16px}
.redbox ul{margin:0;padding-left:20px}
.redbox li{font-size:13px;margin-bottom:6px;line-height:1.5}
.closebox{background:var(--surface);border:1px solid var(--line);border-radius:13px;padding:16px 18px;margin-top:14px}
.closebox h3{font-family:'Space Grotesk';font-size:13px;margin:0 0 8px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}
.closebox li{font-size:13.5px;margin-bottom:5px}
.tally{position:sticky;bottom:0;margin-top:30px;background:var(--ink);color:#fff;border-radius:13px;padding:14px 18px;display:flex;align-items:center;gap:18px;flex-wrap:wrap;box-shadow:0 8px 30px rgba(20,16,30,.2)}
.tally .t{font-family:'Space Grotesk';font-size:13px;font-weight:600}
.tally .grp{display:flex;gap:14px;margin-left:auto;flex-wrap:wrap}
.tally .ct{display:flex;align-items:center;gap:7px;font-size:13px}
.tally .ct .d{width:9px;height:9px;border-radius:50%}
.tally .ct.g .d{background:#3ad08b}.tally .ct.o .d{background:#e8c25a}.tally .ct.b .d{background:#ee7878}
.tally .ct .v{font-family:'JetBrains Mono';font-weight:600}
`;

const EXAMPLES = [
  { t: "Hiring Manager — People & Talent", d: "Recruiting role · MONA AI", text: `Hiring Manager — People & Talent. Company: MONA AI GmbH (applied AI agents for enterprise). Location: Saarbrücken (hybrid). Reports to Head of People. Full-time.
Run full-cycle recruiting: intake, sourcing, screening, scheduling, offer and close. Design structured interview kits and scorecards with hiring leads; standardise rubrics. Own the ATS, pipeline hygiene and weekly hiring metrics (funnel, time-to-fill, pass-through). Coach interviewers on bias-aware, competency-based interviewing. Manage employer branding and a GDPR-compliant candidate experience.
Must-have: 3+ years in-house recruiting/talent acquisition, ideally tech/startups. Track record closing technical and non-technical roles. Hands-on with an ATS (Greenhouse, Personio, Join) and structured interviewing. Fluent German and English. Working knowledge of German labour-law basics and GDPR in recruiting.
Nice to have: hiring AI/ML or data talent; competency frameworks and work-sample assessments; building simple hiring dashboards. Stack: Personio/Join ATS, LinkedIn Recruiter, scorecards, BI for funnel metrics.` },
  { t: "Go-to-Market Engineer", d: "Technical-commercial · MONA AI", text: `Go-to-Market (GTM) Engineer. Company: MONA AI GmbH. Location: Saarbrücken / remote (EU). Team: Revenue, across Sales, Marketing & Product. Full-time.
A hybrid technical-commercial role. Automate the GTM motion end-to-end: enrich and route leads, build outbound and lifecycle workflows, wire data between CRM and product, ship internal tools (often AI-assisted) for the revenue team.
What you'll do: design lead enrichment, scoring and routing pipelines; build outbound/lifecycle automations across CRM, product and billing; develop internal tools and LLM-powered workflows for sales & CS; instrument the funnel (event tracking, attribution, dashboards); run experiments on messaging and conversion.
Must-have: 2+ years GTM/RevOps/sales-engineering or software engineering touching go-to-market; strong with APIs, webhooks and scripting (Python or JS/TS); hands-on CRM automation (HubSpot or Salesforce) and SQL; comfortable building with LLM APIs and prompt workflows; clear communicator between technical and commercial teams.
Nice to have: iPaaS/workflow tools (Zapier, Make, n8n), reverse-ETL; product-led growth instrumentation; startup 0 to 1 GTM tooling. Stack: Python/TypeScript, HubSpot/Salesforce, SQL & warehouse (BigQuery/Postgres), REST/webhooks, LLM APIs, n8n/Make/Zapier, Looker/Metabase.` },
  { t: "Forward Deployed Engineer", d: "Senior, customer-facing · MONA AI", text: `Forward Deployed Engineer (FDE). Company: MONA AI GmbH. Location: Saarbrücken HQ + on-site at customers (travel up to ~30%). Team: Delivery / Solutions Engineering. Reports to Head of Delivery. Full-time.
FDEs are senior engineers who deploy directly into customer environments, scope ambiguous problems, and build and integrate AI-agent solutions against real data and systems. Own delivery from discovery to production hand-off; the technical face to the customer.
What you'll do: scope customer problems on-site and translate vague requirements into a concrete plan; build, integrate and deploy agentic workflows against customer data, APIs and systems; design retrieval/RAG pipelines and evaluate LLM output quality with real test sets; harden integrations (auth, error handling, observability, security/PII); run production hand-off, docs and enablement.
Must-have: 4+ years software engineering with strong Python (and SQL); production systems; built and shipped LLM/agent or data-integration systems against messy real-world data; solid on APIs, cloud (AWS/GCP/Azure), containers, CI/CD; customer-facing maturity (run a workshop, say no diplomatically); fluent English, German a plus.
Nice to have: RAG, vector databases, LLM evaluation/guardrails; regulated/enterprise (security, GDPR, audit); prior consulting/solutions-engineering. Stack: Python, SQL, LLM & agent frameworks, vector DBs (pgvector/Pinecone/Weaviate), RAG & eval tooling, AWS/GCP/Azure, Docker, REST/gRPC, observability.` },
];

const PROMPT = `You are an interview-design assistant helping a NON-TECHNICAL hiring manager interview candidates. Read the job description and build an interview kit. Return ONLY valid JSON (no markdown):
{"role_title":"","company":"","seniority":"Junior|Mid|Senior","summary":"2-3 plain-language sentences: what this person actually does day to day and why it matters — no jargon","key_skills":["the real must-have skills/experience, in plain words"],"sections":[{"name":"section title","questions":[{"q":"a specific interview question tailored to THIS role and its tools/stack","why":"what this question reveals, explained for a non-technical manager","good":"what a strong answer sounds like — concrete signals to listen for","red":"what a weak or concerning answer sounds like"}]}],"red_flags":["overall warning signs for this hire, plain language"],"closing":["1-2 good closing questions any manager can ask"]}
Make questions SPECIFIC to the role's tools, stack and responsibilities — not generic. Cover: motivation, real experience depth, role-specific/technical depth (phrase technical questions so a non-technical manager can ask them aloud and judge the answer using the good/red guidance), and working style/communication. Produce 4-5 sections with 2-4 questions each. Every explanation must be jargon-free.`;

async function generateKit({ text, pdfBase64 }) {
  const parts = [];
  if (pdfBase64) parts.push({ inline_data: { mime_type: "application/pdf", data: pdfBase64 } });
  else parts.push({ text: "JOB DESCRIPTION:\n" + text });
  parts.push({ text: PROMPT });
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_KEY}`;
  const body = JSON.stringify({ contents: [{ parts }], generationConfig: { temperature: 0.3, maxOutputTokens: 8192, responseMimeType: "application/json" } });
  let lastErr;
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error?.message || ("API " + res.status));
      const t = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
      const c = t.replace(/```json/g, "").replace(/```/g, "").trim();
      const kit = JSON.parse(c.slice(c.indexOf("{"), c.lastIndexOf("}") + 1));
      if (!kit.sections?.length) throw new Error("Empty kit");
      return kit;
    } catch (e) { lastErr = e; if (i < 2) await new Promise((r) => setTimeout(r, 800 * (i + 1))); }
  }
  throw lastErr;
}

const Icon = {
  spark: <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.8 2.8M14.9 14.9l2.8 2.8M17.7 6.3l-2.8 2.8M9.1 14.9l-2.8 2.8"/></svg>,
  up: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 16V4m-5 5 5-5 5 5M5 20h14"/></svg>,
  check: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6 9 17l-5-5"/></svg>,
  warn: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>,
  x: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>,
  back: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>,
  copy: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>,
};

export default function App() {
  const [text, setText] = useState("");
  const [kit, setKit] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [verdicts, setVerdicts] = useState({});
  const [notes, setNotes] = useState({});
  const fileRef = useRef();

  async function run(payload) {
    setLoading(true); setError(null); setKit(null); setVerdicts({}); setNotes({});
    try { setKit(await generateKit(payload)); }
    catch (e) { setError("The agent couldn't build the kit. Try again, or paste the job text instead of a PDF."); }
    setLoading(false);
  }
  function onFile(file) { const r = new FileReader(); r.onload = () => run({ pdfBase64: r.result.split(",")[1] }); r.readAsDataURL(file); }
  function copyKit() {
    if (!kit) return;
    let out = `INTERVIEW KIT — ${kit.role_title} (${kit.company || ""})\n${kit.summary}\n\n`;
    kit.sections.forEach((s) => { out += `## ${s.name}\n`; s.questions.forEach((q) => { out += `Q: ${q.q}\n  Why: ${q.why}\n  Strong answer: ${q.good}\n  Watch for: ${q.red}\n\n`; }); });
    out += `RED FLAGS:\n` + (kit.red_flags || []).map((r) => "- " + r).join("\n");
    navigator.clipboard?.writeText(out);
  }
  const setVerdict = (id, v) => setVerdicts((p) => ({ ...p, [id]: p[id] === v ? null : v }));
  const tally = Object.values(verdicts).reduce((a, v) => { if (v) a[v]++; return a; }, { good: 0, ok: 0, bad: 0 });

  return (
    <div className="rl-root">
      <style>{STYLES}</style>
      <aside className="rl-side">
        <div className="rl-brand"><div className="rl-mark">{Icon.spark}</div><div><h1>Interview Copilot</h1><span>Kohlpharma · Hiring</span></div></div>
        <div className="side-note">Posted a role you don't fully understand? <b>Paste the job ad</b> and I'll turn it into questions you can actually ask — and tell you what a good answer sounds like.</div>
        <div className="side-steps">
          <div className="sstep"><span className="n">1</span> Paste the job ad or upload the PDF</div>
          <div className="sstep"><span className="n">2</span> Get tailored questions + red flags</div>
          <div className="sstep"><span className="n">3</span> Score answers live as you interview</div>
        </div>
        <div className="rl-agent"><div className="row"><span className="rl-dot" /> Agent ready</div></div>
      </aside>

      <div className="rl-main">
        <div className="rl-body">
          <div className="wrap">
            {!kit && !loading && (
              <div className="intro">
                <h2>Build an interview kit from any job ad</h2>
                <p>Paste the role you posted on Indeed. The agent reads it and gives you specific questions, explains what each one is really testing, and flags what to watch out for — no technical background needed.</p>
                <div className="inputcard">
                  <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste the full job advert here…" />
                  <div className="inrow">
                    <button className="btn btn-acc" disabled={!text.trim()} onClick={() => run({ text })}>{Icon.spark} Build interview kit</button>
                    <input ref={fileRef} type="file" accept="application/pdf" style={{ display: "none" }} onChange={(e) => e.target.files[0] && onFile(e.target.files[0])} />
                    <button className="btn" onClick={() => fileRef.current?.click()}>{Icon.up} Upload job ad (PDF)</button>
                  </div>
                  {error && <div className="err">{error}</div>}
                </div>
                <div className="exlabel">Or try one of the sample roles:</div>
                <div className="exrow">
                  {EXAMPLES.map((e, i) => (
                    <button key={i} className="exchip" onClick={() => run({ text: e.text })}><div className="t">{e.t}</div><div className="d">{e.d}</div></button>
                  ))}
                </div>
              </div>
            )}

            {loading && <div className="loading"><div className="ring" /><h4>Reading the job ad…</h4><p>Writing tailored questions and spotting red flags</p></div>}

            {kit && (
              <div>
                <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
                  <button className="btn" onClick={() => { setKit(null); setError(null); }}>{Icon.back} New role</button>
                  <button className="btn" onClick={copyKit}>{Icon.copy} Copy kit</button>
                </div>
                <div className="kithead">
                  <div style={{ flex: 1 }}><div className="k">Interview kit</div><h2>{kit.role_title}</h2><div className="co">{kit.company}</div></div>
                  {kit.seniority && <span className="seniority">{kit.seniority} level</span>}
                </div>
                <div className="summary"><div className="lab">What this person actually does</div><p>{kit.summary}</p></div>
                {kit.key_skills?.length > 0 && <div className="skills">{kit.key_skills.map((s, i) => <span key={i} className="skill">{s}</span>)}</div>}

                {kit.sections.map((sec, si) => (
                  <div key={si} className="sec">
                    <h3 className="sec-h"><span className="num">{si + 1}</span>{sec.name}</h3>
                    {sec.questions.map((q, qi) => {
                      const id = si + "-" + qi;
                      return (
                        <div key={qi} className="qcard">
                          <div className="q">{q.q}</div>
                          {q.why && <div className="why"><b>Why ask:</b> {q.why}</div>}
                          <div className="ga">
                            <div className="flag good"><div className="fl">{Icon.check} Strong answer</div>{q.good}</div>
                            <div className="flag bad"><div className="fl">{Icon.warn} Watch for</div>{q.red}</div>
                          </div>
                          <div className="verdict">
                            <span className="vl">Their answer:</span>
                            <button className={"vbtn" + (verdicts[id] === "good" ? " on-good" : "")} onClick={() => setVerdict(id, "good")}>{Icon.check} Strong</button>
                            <button className={"vbtn" + (verdicts[id] === "ok" ? " on-ok" : "")} onClick={() => setVerdict(id, "ok")}>OK</button>
                            <button className={"vbtn" + (verdicts[id] === "bad" ? " on-bad" : "")} onClick={() => setVerdict(id, "bad")}>{Icon.x} Concern</button>
                          </div>
                          <textarea className="qnote" placeholder="Notes…" value={notes[id] || ""} onChange={(e) => setNotes((p) => ({ ...p, [id]: e.target.value }))} />
                        </div>
                      );
                    })}
                  </div>
                ))}

                {kit.red_flags?.length > 0 && <div className="redbox"><h3>{Icon.warn} Red flags for this role</h3><ul>{kit.red_flags.map((r, i) => <li key={i}>{r}</li>)}</ul></div>}
                {kit.closing?.length > 0 && <div className="closebox"><h3>Good closing questions</h3><ul style={{ margin: 0, paddingLeft: 20 }}>{kit.closing.map((c, i) => <li key={i}>{c}</li>)}</ul></div>}

                <div className="tally">
                  <span className="t">Your scorecard</span>
                  <div className="grp">
                    <span className="ct g"><span className="d" /> Strong <span className="v">{tally.good}</span></span>
                    <span className="ct o"><span className="d" /> OK <span className="v">{tally.ok}</span></span>
                    <span className="ct b"><span className="d" /> Concern <span className="v">{tally.bad}</span></span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
