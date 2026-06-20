import { useState, useMemo, useRef, useEffect } from "react";
import mammoth from "mammoth";

/* =============================================================
   INVOICE PILOT — Invoice-processing agent for Globus Group
   Reads supplier invoices from the inbox, pulls out every field,
   picks the category, and routes each one to the department that
   has to confirm it. Accepts PDF, PNG/JPG, Word (.docx) and CSV.
   ============================================================= */

const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap');
:root{
  --ink:#141A2A; --ink-2:#1E2740; --ink-3:#2A3552;
  --paper:#EEF1F6; --surface:#FFFFFF; --surface-2:#F7F9FC;
  --line:#E2E7F0; --line-strong:#CDD5E3;
  --text:#1F2738; --muted:#6A7489; --muted-2:#9AA3B6;
  --primary:#2B4ACB; --primary-ink:#1C3290;
  --agent:#6D5CE0; --agent-soft:#EEEBFB;
  --ok:#1A8F55; --ok-soft:#E4F4EC;
  --warn:#C9870C; --warn-soft:#FBF0DA;
  --bad:#CE3F3F; --bad-soft:#FBE7E7;
}
*{box-sizing:border-box}
.rl-root{font-family:'Inter',system-ui,sans-serif;color:var(--text);background:var(--paper);min-height:100vh;display:flex;font-size:14px;line-height:1.45}
.rl-root button{font-family:inherit;cursor:pointer}
.mono{font-family:'JetBrains Mono',ui-monospace,monospace;font-variant-numeric:tabular-nums}
.rl-side{width:240px;flex:0 0 240px;background:var(--ink);color:#C7CEDD;display:flex;flex-direction:column;padding:22px 16px;position:sticky;top:0;height:100vh}
.rl-brand{display:flex;gap:11px;align-items:center;padding:0 6px 4px}
.rl-mark{width:34px;height:34px;border-radius:9px;background:linear-gradient(140deg,var(--agent),#9B66E6);display:grid;place-items:center;flex:0 0 34px;box-shadow:0 4px 14px rgba(109,92,224,.45)}
.rl-mark svg{width:19px;height:19px}
.rl-brand h1{font-family:'Space Grotesk';font-size:17px;font-weight:600;color:#fff;margin:0;letter-spacing:-.02em}
.rl-brand span{font-size:11px;color:var(--muted-2);display:block;margin-top:1px}
.rl-nav{margin-top:26px;display:flex;flex-direction:column;gap:3px}
.rl-nav button{display:flex;align-items:center;gap:11px;width:100%;background:none;border:0;color:#AAB3C6;padding:9px 11px;border-radius:9px;font-size:13.5px;font-weight:500;text-align:left;transition:.12s}
.rl-nav button:hover{background:var(--ink-2);color:#E6EAF2}
.rl-nav button.on{background:var(--ink-3);color:#fff}
.rl-nav .ct{margin-left:auto;font-size:11px;font-weight:600;background:#33405f;color:#cfd6e6;padding:1px 7px;border-radius:20px;min-width:20px;text-align:center}
.rl-nav button.on .ct{background:var(--agent);color:#fff}
.rl-agent{margin-top:auto;background:var(--ink-2);border:1px solid #2c374f;border-radius:11px;padding:12px}
.rl-agent .row{display:flex;align-items:center;gap:8px;font-size:12px;color:#cfd6e6;font-weight:500}
.rl-dot{width:8px;height:8px;border-radius:50%;background:var(--agent);animation:pulse 2s infinite}
@keyframes pulse{0%{box-shadow:0 0 0 0 rgba(109,92,224,.5)}70%{box-shadow:0 0 0 7px rgba(109,92,224,0)}100%{box-shadow:0 0 0 0 rgba(109,92,224,0)}}
.rl-agent p{font-size:11px;color:var(--muted-2);margin:7px 0 0;line-height:1.4}
.rl-main{flex:1;min-width:0;display:flex;flex-direction:column}
.rl-top{background:var(--surface);border-bottom:1px solid var(--line);padding:16px 26px;display:flex;align-items:center;gap:16px;position:sticky;top:0;z-index:5}
.rl-top h2{font-family:'Space Grotesk';font-size:18px;font-weight:600;margin:0;letter-spacing:-.02em}
.rl-top .sub{font-size:12.5px;color:var(--muted);margin-top:1px}
.rl-top .spacer{flex:1}
.btn{border:1px solid var(--line-strong);background:var(--surface);color:var(--text);padding:8px 14px;border-radius:9px;font-size:13px;font-weight:500;display:inline-flex;align-items:center;gap:7px;transition:.12s}
.btn:hover{border-color:var(--muted-2);background:var(--surface-2)}
.btn-pri{background:var(--primary);border-color:var(--primary);color:#fff}
.btn-agent{background:var(--agent);border-color:var(--agent);color:#fff}
.btn-agent:hover{filter:brightness(.94)}
.btn:disabled{opacity:.5;cursor:not-allowed}
.btn svg{width:15px;height:15px}
.rl-body{flex:1;padding:22px 26px 60px;overflow:auto}
.split{display:grid;grid-template-columns:380px 1fr;gap:18px;align-items:start}
@media(max-width:1080px){.split{grid-template-columns:1fr}}
.panel{background:var(--surface);border:1px solid var(--line);border-radius:14px}
.panel-h{padding:13px 16px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:9px}
.panel-h h3{font-family:'Space Grotesk';font-size:13.5px;font-weight:600;margin:0}
.panel-h .pill{margin-left:auto;font-size:11px;color:var(--muted);background:var(--surface-2);border:1px solid var(--line);padding:2px 9px;border-radius:20px}
.drop{margin:14px 16px;border:1.5px dashed var(--line-strong);border-radius:11px;padding:18px 14px;text-align:center;transition:.15s;background:var(--surface-2)}
.drop.hot{border-color:var(--agent);background:var(--agent-soft)}
.drop svg{width:22px;height:22px;color:var(--agent);margin-bottom:5px}
.drop p{margin:0;font-size:12.5px;color:var(--muted)}
.drop b{color:var(--text);font-weight:600}
.drop .or{font-size:11px;color:var(--muted-2);margin-top:6px}
.mlist{padding:6px}
.mrow{display:flex;gap:11px;padding:11px;border-radius:10px;cursor:pointer;transition:.1s;align-items:flex-start}
.mrow:hover{background:var(--surface-2)}
.mrow.on{background:#EFF3FF;outline:1px solid #C9D6FB}
.mav{width:34px;height:34px;border-radius:8px;flex:0 0 34px;display:grid;place-items:center;font-family:'Space Grotesk';font-weight:600;font-size:13px;color:#fff}
.mmeta{min-width:0;flex:1}
.mmeta .f{display:flex;align-items:center;gap:6px}
.mmeta .from{font-weight:600;font-size:13px;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mmeta .time{margin-left:auto;font-size:11px;color:var(--muted-2);white-space:nowrap}
.mmeta .subj{font-size:12.5px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:1px}
.attach{display:inline-flex;align-items:center;gap:5px;font-size:11px;color:var(--muted);background:var(--surface-2);border:1px solid var(--line);padding:2px 8px;border-radius:6px;margin-top:6px}
.attach svg{width:12px;height:12px}
.ftag{font-size:9.5px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;padding:1px 5px;border-radius:4px;margin-left:4px}
.sbadge{font-size:10.5px;font-weight:600;padding:2px 8px;border-radius:20px;margin-top:6px;display:inline-block}
.s-new{background:#EAEEF6;color:#566177}
.s-checked{background:var(--agent-soft);color:#5a49c2}
.s-approved{background:var(--ok-soft);color:var(--ok)}
.s-review{background:var(--warn-soft);color:var(--warn)}
.s-rejected{background:var(--bad-soft);color:var(--bad)}
.empty{display:grid;place-items:center;min-height:420px;text-align:center;color:var(--muted)}
.empty svg{width:38px;height:38px;color:var(--line-strong);margin-bottom:12px}
.dt-head{padding:18px 20px;border-bottom:1px solid var(--line);display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap}
.dt-sup{flex:1;min-width:200px}
.dt-sup .k{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted-2);font-weight:600}
.dt-sup h2{font-family:'Space Grotesk';font-size:20px;font-weight:600;margin:3px 0 2px;letter-spacing:-.02em}
.dt-sup .addr{font-size:12px;color:var(--muted)}
.dt-amt{text-align:right}
.dt-amt .big{font-family:'JetBrains Mono';font-size:26px;font-weight:600;letter-spacing:-.02em;color:var(--text)}
.dt-amt .lbl{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em}
.cat-chip{display:inline-flex;align-items:center;gap:7px;font-size:12.5px;font-weight:600;padding:5px 12px;border-radius:9px;border:1px solid}
.route-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;background:var(--agent-soft);border:1px solid #ddd6f7;border-radius:11px;padding:11px 14px;margin:16px 20px 0}
.route-bar svg{width:16px;height:16px;color:var(--agent);flex:0 0 16px}
.route-bar .t{font-size:13px}
.route-bar .dept{font-weight:600;color:#5a49c2}
.route-bar .confid{margin-left:auto;font-size:11px;color:var(--muted)}
.dt-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 26px;padding:16px 20px}
@media(max-width:560px){.dt-grid{grid-template-columns:1fr}}
.field{display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px dashed var(--line)}
.field .fk{font-size:12.5px;color:var(--muted)}
.field .fv{font-size:13px;font-weight:500;text-align:right}
.field .fv.miss{color:var(--bad);font-style:italic;font-weight:400}
.sec-h{font-family:'Space Grotesk';font-size:13px;font-weight:600;padding:6px 20px;margin-top:8px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}
.items{margin:0 20px;border:1px solid var(--line);border-radius:10px;overflow:hidden}
.items table{width:100%;border-collapse:collapse;font-size:12.5px}
.items th{text-align:left;background:var(--surface-2);color:var(--muted);font-weight:600;padding:8px 12px;font-size:11px;text-transform:uppercase;letter-spacing:.04em}
.items td{padding:8px 12px;border-top:1px solid var(--line)}
.items td.num,.items th.num{text-align:right;font-family:'JetBrains Mono'}
.checks{margin:6px 20px 0;display:flex;flex-direction:column;gap:7px}
.chk{display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border-radius:10px;border:1px solid}
.chk .ico{width:18px;height:18px;flex:0 0 18px;margin-top:1px}
.chk.pass{background:var(--ok-soft);border-color:#cdebd9}
.chk.warn{background:var(--warn-soft);border-color:#f0e0bb}
.chk.fail{background:var(--bad-soft);border-color:#f3cccc}
.chk .ct2{font-size:13px;font-weight:500}
.chk .cd{font-size:12px;color:var(--muted);margin-top:2px}
.chk.pass .ico{color:var(--ok)} .chk.warn .ico{color:var(--warn)} .chk.fail .ico{color:var(--bad)}
.actions{display:flex;gap:10px;padding:18px 20px;border-top:1px solid var(--line);margin-top:16px;flex-wrap:wrap}
.btn-ok{background:var(--ok);border-color:var(--ok);color:#fff}
.btn-ok:hover{filter:brightness(.94)}
.btn-warn{background:var(--surface);border-color:#e7d3a3;color:var(--warn)}
.btn-warn:hover{background:var(--warn-soft)}
.btn-bad{background:var(--surface);border-color:#eac4c4;color:var(--bad)}
.btn-bad:hover{background:var(--bad-soft)}
.actions .note{margin-left:auto;align-self:center;font-size:12px;color:var(--muted)}
.scan{position:relative;padding:50px 20px;text-align:center;overflow:hidden}
.scan .doc{width:130px;height:170px;margin:0 auto 18px;border-radius:8px;background:var(--surface-2);border:1px solid var(--line);position:relative;overflow:hidden;box-shadow:0 6px 18px rgba(30,40,70,.08)}
.scan .doc .ln{height:7px;background:var(--line);border-radius:3px;margin:11px 12px}
.scan .doc .ln:nth-child(2){width:60%}.scan .doc .ln:nth-child(3){width:85%}.scan .doc .ln:nth-child(4){width:72%}.scan .doc .ln:nth-child(5){width:90%}.scan .doc .ln:nth-child(6){width:50%}
.scan .sweep{position:absolute;left:0;right:0;height:30px;top:-30px;background:linear-gradient(180deg,transparent,rgba(109,92,224,.35),transparent);animation:sweep 1.5s ease-in-out infinite}
@keyframes sweep{0%{top:-30px}100%{top:175px}}
.scan h4{font-family:'Space Grotesk';font-size:15px;margin:0 0 4px}
.scan p{font-size:13px;color:var(--agent);font-weight:500;margin:0;min-height:18px}
.scan .barwrap{width:220px;height:5px;background:var(--line);border-radius:4px;margin:14px auto 0;overflow:hidden}
.scan .bar{height:100%;background:var(--agent);border-radius:4px;animation:grow 8s linear forwards}
@keyframes grow{0%{width:5%}60%{width:75%}100%{width:96%}}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:20px}
@media(max-width:880px){.stats{grid-template-columns:repeat(2,1fr)}}
.stat{background:var(--surface);border:1px solid var(--line);border-radius:13px;padding:16px 17px}
.stat .v{font-family:'JetBrains Mono';font-size:27px;font-weight:600;letter-spacing:-.02em}
.stat .l{font-size:12px;color:var(--muted);margin-top:3px;font-weight:500}
.stat .ic{width:30px;height:30px;border-radius:8px;display:grid;place-items:center;margin-bottom:11px}
.stat .ic svg{width:16px;height:16px}
.dash-grid{display:grid;grid-template-columns:1.3fr 1fr;gap:18px;align-items:start}
@media(max-width:980px){.dash-grid{grid-template-columns:1fr}}
.catrow{display:flex;align-items:center;gap:12px;padding:10px 16px;border-bottom:1px solid var(--line)}
.catrow:last-child{border-bottom:0}
.catrow .nm{font-size:13px;font-weight:500;width:170px;flex:0 0 170px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.catrow .track{flex:1;height:8px;background:var(--surface-2);border-radius:5px;overflow:hidden}
.catrow .fill{height:100%;border-radius:5px}
.catrow .amt{font-family:'JetBrains Mono';font-size:12.5px;color:var(--muted);width:96px;text-align:right;flex:0 0 96px}
.act{display:flex;gap:11px;padding:11px 16px;border-bottom:1px solid var(--line);align-items:center}
.act:last-child{border-bottom:0}
.act .d{width:8px;height:8px;border-radius:50%;flex:0 0 8px}
.act .tx{font-size:12.5px}.act .tx b{font-weight:600}
.act .tm{margin-left:auto;font-size:11px;color:var(--muted-2)}
.errbox{margin:0 0 16px;padding:12px 14px;background:var(--bad-soft);border:1px solid #f3cccc;border-radius:10px;font-size:12.5px;color:#9a3030}
`;

/* category -> department + approver + colour */
const ROUTING = {
  "Merchandise": { dept: "Purchasing", approver: "Sabine Keller", color: "#1A8F55", soft: "#E4F4EC", border: "#cdebd9" },
  "IT & Software": { dept: "IT", approver: "Markus Brandt", color: "#2B4ACB", soft: "#E9EEFC", border: "#cdd9f7" },
  "Facilities": { dept: "Facility Management", approver: "Petra Hoffmann", color: "#9A5BC2", soft: "#F2E9F8", border: "#e6d4f0" },
  "Logistics & Transport": { dept: "Logistics", approver: "Thomas Wagner", color: "#C9870C", soft: "#FBF0DA", border: "#f0e0bb" },
  "Marketing & Advertising": { dept: "Marketing", approver: "Julia Berger", color: "#CE3F7C", soft: "#FBE7F1", border: "#f3ccdd" },
  "Energy & Utilities": { dept: "Facility Management", approver: "Petra Hoffmann", color: "#168A8A", soft: "#E2F3F3", border: "#c7e8e8" },
  "Office & Admin": { dept: "Administration", approver: "Andreas Klein", color: "#5A6573", soft: "#EEF0F4", border: "#dde1e9" },
  "Maintenance & Technical": { dept: "Technical", approver: "Stefan Vogt", color: "#B5651D", soft: "#F7EBDF", border: "#ecd6bf" },
  "Other": { dept: "Accounts Payable", approver: "AP Team", color: "#6A7489", soft: "#EEF0F4", border: "#dde1e9" },
};
const CATS = Object.keys(ROUTING);

/* file-type tags */
const FTAG = {
  pdf: { l: "PDF", bg: "#FBE7E7", c: "#b33" }, png: { l: "PNG", bg: "#E2F3F3", c: "#168A8A" },
  jpg: { l: "JPG", bg: "#E2F3F3", c: "#168A8A" }, jpeg: { l: "JPG", bg: "#E2F3F3", c: "#168A8A" },
  docx: { l: "DOCX", bg: "#E9EEFC", c: "#2B4ACB" }, csv: { l: "CSV", bg: "#E4F4EC", c: "#1A8F55" },
};

/* seeded inbox — mixed file formats */
const SAMPLES = [
  { id: "m1", from: "Saar-IT Solutions", email: "billing@saar-it.de", subject: "Invoice 2026-04417 — Microsoft 365 licences", time: "08:14", color: "#2B4ACB", attachment: "INV_2026-04417.pdf", ftype: "pdf", status: "new",
    rawText: `Saar-IT Solutions GmbH, Bahnhofstr. 12, 66606 St. Wendel\nVAT ID: DE812345678\nInvoice No. 2026-04417 | Invoice date: 02 Jun 2026 | Delivery date: 31 May 2026\nPurchase order: PO-2026-1188 | Customer: Globus Group, St. Wendel\nLine 1: Microsoft 365 Business (licence) | 40 | 12.50 | 500.00\nLine 2: Support flat rate May | 1 | 350.00 | 350.00\nNet 850.00 EUR | VAT 19% 161.50 EUR | Total 1,011.50 EUR\nDue 16 Jun 2026 | IBAN: DE89 5905 0101 0012 3456 78`,
    fallback: { supplier: "Saar-IT Solutions GmbH", supplier_address: "Bahnhofstr. 12, 66606 St. Wendel", invoice_no: "2026-04417", invoice_date: "2026-06-02", due_date: "2026-06-16", po_number: "PO-2026-1188", vat_id: "DE812345678", iban: "DE89 5905 0101 0012 3456 78", currency: "EUR", net: 850, vat_amount: 161.5, vat_rate: 19, gross: 1011.5, category: "IT & Software", category_reason: "Software licences and IT support.", confidence: 0.97, line_items: [{ description: "Microsoft 365 Business (licence)", qty: 40, unit_price: 12.5, total: 500 }, { description: "Support flat rate May", qty: 1, unit_price: 350, total: 350 }] } },
];

const fmtEUR = (n) => n == null || isNaN(n) ? "—" : new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR" }).format(n);
const fmtDate = (s) => { if (!s) return null; const d = new Date(s); if (isNaN(d)) return s; return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); };
const TODAY = new Date("2026-06-20");

function buildPrompt() {
  return `You are an accounts-payable agent. Read this supplier invoice and return ONLY valid JSON (no markdown, no text outside the JSON). The input may be a PDF, an image, Word text, or CSV/plain text. If the input is a CSV or lists several invoices, read the FIRST invoice and return it as a single JSON object. Format:
{"supplier":"","supplier_address":"","invoice_no":"","invoice_date":"YYYY-MM-DD","due_date":"YYYY-MM-DD or null","po_number":"or null","vat_id":"or null","iban":"or null","currency":"EUR","net":0,"vat_amount":0,"vat_rate":0,"gross":0,"line_items":[{"description":"","qty":0,"unit_price":0,"total":0}],"category":"exactly one of: ${CATS.join(", ")}","category_reason":"short","confidence":0.0}
Numbers as numbers (dot as decimal separator), missing values as null.`;
}

/* ── Hackathon key — Gemini. Paste your key between the quotes. ── */
const GEMINI_KEY = "ADD";
/* Model switch: "gemini-2.5-flash-lite" = fastest/cheapest.
   Change to "gemini-2.5-flash" if rough scans come back wrong. */
const MODEL = "gemini-2.5-flash-lite";

async function callAgent(inv) {
  const prompt = buildPrompt();
  const parts = [];
  if (inv.pdfBase64) parts.push({ inline_data: { mime_type: "application/pdf", data: inv.pdfBase64 } });
  else if (inv.imageBase64) parts.push({ inline_data: { mime_type: inv.imageMime, data: inv.imageBase64 } });
  else parts.push({ text: "INVOICE:\n" + inv.rawText });
  parts.push({ text: prompt });
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_KEY}`;
  const body = JSON.stringify({ contents: [{ parts }], generationConfig: { temperature: 0, maxOutputTokens: 2048, responseMimeType: "application/json" } });

  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {   // auto-retry, no manual clicking
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error?.message || ("API " + res.status));
      const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
      const clean = text.replace(/```json/g, "").replace(/```/g, "").trim();
      let parsed;
      try { parsed = JSON.parse(clean); }
      catch { parsed = JSON.parse(clean.slice(clean.indexOf("{"), clean.lastIndexOf("}") + 1)); }
      if (Array.isArray(parsed)) parsed = parsed[0];   // CSV with several rows -> take the first invoice
      if (!parsed || !parsed.supplier) throw new Error("No invoice found in file");
      return parsed;
    } catch (e) {
      lastErr = e;
      if (attempt < 2) await new Promise((r) => setTimeout(r, 700 * (attempt + 1)));
    }
  }
  throw lastErr;
}

function runChecks(d, others) {
  const c = [];
  if (d.net != null && d.vat_amount != null && d.gross != null) {
    const sum = +(d.net + d.vat_amount).toFixed(2);
    const ok = Math.abs(sum - d.gross) < 0.02;
    c.push({ status: ok ? "pass" : "fail", label: "Arithmetic check: net + VAT = gross",
      detail: ok ? `${fmtEUR(d.net)} + ${fmtEUR(d.vat_amount)} = ${fmtEUR(d.gross)}` : `Adds up to ${fmtEUR(sum)}, but the invoice states ${fmtEUR(d.gross)} — off by ${fmtEUR(Math.abs(sum - d.gross))}` });
  }
  if (d.net && d.vat_amount != null) {
    const rate = (d.vat_amount / d.net) * 100;
    const known = [0, 7, 19].some((r) => Math.abs(rate - r) < 0.4);
    c.push({ status: known ? "pass" : "warn", label: "VAT rate plausible", detail: `Calculated rate: ${rate.toFixed(1)}%` + (known ? "" : " — not a standard rate (0/7/19%)") });
  }
  const missing = [];
  if (!d.invoice_no) missing.push("invoice number");
  if (!d.invoice_date) missing.push("invoice date");
  if (!d.supplier) missing.push("supplier");
  if (d.gross == null) missing.push("total");
  c.push({ status: missing.length ? "fail" : "pass", label: "Required fields present", detail: missing.length ? "Missing: " + missing.join(", ") : "All required fields found" });
  c.push({ status: d.po_number ? "pass" : "warn", label: "Purchase order (PO) matched", detail: d.po_number ? d.po_number : "No PO — needs matching by the department" });
  const dup = others.find((o) => o.data && o.data.invoice_no && o.data.invoice_no === d.invoice_no);
  c.push({ status: dup ? "fail" : "pass", label: "Duplicate check", detail: dup ? `Invoice no. ${d.invoice_no} already recorded (${dup.from}) — possible duplicate` : "No duplicate invoice number found" });
  if (d.due_date) {
    const due = new Date(d.due_date), overdue = due < TODAY, soon = !overdue && (due - TODAY) / 864e5 <= 5;
    c.push({ status: overdue || soon ? "warn" : "pass", label: "Payment due date", detail: overdue ? `Overdue since ${fmtDate(d.due_date)}` : soon ? `Due ${fmtDate(d.due_date)} — soon` : `Due ${fmtDate(d.due_date)}` });
  }
  return c;
}

const SCAN_MSGS = ["Reading the document …", "Pulling out amounts and dates …", "Matching the supplier …", "Deciding the category …", "Running the checks …"];

const I = {
  bot: <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><rect x="4" y="8" width="16" height="11" rx="2"/><path d="M12 8V4M9 4h6M8 13h.01M16 13h.01M9 17h6"/></svg>,
  inbox: (c = "currentColor") => <svg viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><path d="M3 12h5l2 3h4l2-3h5M5 5h14l1 7v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-5z"/></svg>,
  check: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6 9 17l-5-5"/></svg>,
  warn: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>,
  x: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="m15 9-6 6M9 9l6 6"/></svg>,
  route: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 19V9a4 4 0 0 1 4-4h6"/><path d="m12 2 3 3-3 3"/><circle cx="5" cy="19" r="2"/></svg>,
  up: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 16V4m-5 5 5-5 5 5M5 20h14"/></svg>,
  paper: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>,
  euro: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 7a6 6 0 1 0 0 10M4 11h8M4 14h7"/></svg>,
  clock: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>,
};
const STATUS_LABEL = { new: "New", checked: "Checked by agent", approved: "Approved", review: "Needs review", rejected: "Rejected" };

export default function App() {
  const [inv, setInv] = useState(SAMPLES.map((s) => ({ ...s, data: null, checks: null, processing: false, error: null })));
  const [sel, setSel] = useState(SAMPLES[0].id);
  const [view, setView] = useState("inbox");
  const [hot, setHot] = useState(false);
  const [bulk, setBulk] = useState(false);
  const fileRef = useRef();

  const counts = useMemo(() => { const c = { new: 0, checked: 0, approved: 0, review: 0, rejected: 0 }; inv.forEach((i) => c[i.status]++); return c; }, [inv]);
  const filtered = useMemo(() => {
    if (view === "inbox") return inv.filter((i) => i.status === "new" || i.status === "checked");
    if (view === "review") return inv.filter((i) => i.status === "checked" || i.status === "review");
    if (view === "done") return inv.filter((i) => i.status === "approved" || i.status === "rejected");
    return inv;
  }, [inv, view]);
  const selected = inv.find((i) => i.id === sel);

  async function process(id) {
    setInv((p) => p.map((i) => i.id === id ? { ...i, processing: true, error: null } : i));
    const target = inv.find((i) => i.id === id);
    const others = inv.filter((i) => i.id !== id);
    let data, err = null;
    try { data = await callAgent(target); }
    catch (e) { if (target.fallback) data = target.fallback; else err = "The agent couldn't read this file. Please try again."; }
    setInv((p) => p.map((i) => {
      if (i.id !== id) return i;
      if (err) return { ...i, processing: false, error: err };
      return { ...i, processing: false, data, checks: runChecks(data, others), status: "checked", error: null };
    }));
  }
  async function processAll() { setBulk(true); for (const t of inv.filter((i) => i.status === "new")) await process(t.id); setBulk(false); }
  function decide(id, status) { setInv((p) => p.map((i) => i.id === id ? { ...i, status } : i)); }

  function readFile(file) {
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    const id = "u" + Date.now() + Math.random().toString(36).slice(2, 6);
    const base = { id, from: file.name.replace(/\.[^.]+$/, ""), email: "manual upload", subject: file.name, time: "just now", color: "#6D5CE0", attachment: file.name, ftype: FTAG[ext] ? ext : "pdf", status: "new", rawText: null, fallback: null, data: null, checks: null, processing: false, error: null };
    const add = (extra) => { setInv((p) => [{ ...base, ...extra }, ...p]); setSel(id); setView("inbox"); };
    if (ext === "pdf") { const r = new FileReader(); r.onload = () => add({ pdfBase64: r.result.split(",")[1] }); r.readAsDataURL(file); }
    else if (["png", "jpg", "jpeg"].includes(ext)) { const r = new FileReader(); r.onload = () => add({ imageBase64: r.result.split(",")[1], imageMime: file.type || "image/png" }); r.readAsDataURL(file); }
    else if (ext === "csv") { const r = new FileReader(); r.onload = () => add({ rawText: r.result }); r.readAsText(file); }
    else if (ext === "docx") { const r = new FileReader(); r.onload = () => mammoth.extractRawText({ arrayBuffer: r.result }).then((res) => add({ rawText: res.value })).catch(() => add({ rawText: "", error: "Could not read this Word file." })); r.readAsArrayBuffer(file); }
    else add({ rawText: "", error: "Unsupported file type. Use PDF, PNG/JPG, DOCX or CSV." });
  }
  function onFiles(files) { Array.from(files).forEach(readFile); }

  return (
    <div className="rl-root">
      <style>{STYLES}</style>
      <aside className="rl-side">
        <div className="rl-brand">
          <div className="rl-mark">{I.bot}</div>
          <div><h1>Invoice Pilot</h1><span>Globus Group · St. Wendel</span></div>
        </div>
        <nav className="rl-nav">
          <button className={view === "inbox" ? "on" : ""} onClick={() => setView("inbox")}>{I.inbox(view === "inbox" ? "#fff" : "#AAB3C6")} Inbox <span className="ct">{counts.new + counts.checked}</span></button>
          <button className={view === "review" ? "on" : ""} onClick={() => setView("review")}>{I.route} In review <span className="ct">{counts.checked + counts.review}</span></button>
          <button className={view === "done" ? "on" : ""} onClick={() => setView("done")}>{I.check} Completed <span className="ct">{counts.approved + counts.rejected}</span></button>
          <button className={view === "dashboard" ? "on" : ""} onClick={() => setView("dashboard")}>{I.euro} Overview</button>
        </nav>
        <div className="rl-agent">
          <div className="row"><span className="rl-dot" /> Agent active</div>
          <p>Reads new invoices from the inbox, captures every field and suggests a category and department.</p>
        </div>
      </aside>

      <div className="rl-main">
        <header className="rl-top">
          <div>
            <h2>{view === "inbox" ? "Inbox" : view === "review" ? "In review" : view === "done" ? "Completed" : "Overview"}</h2>
            <div className="sub">{view === "dashboard" ? "Invoice processing at a glance" : "Supplier invoices · Finance"}</div>
          </div>
          <div className="spacer" />
          {view !== "dashboard" && <>
            <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.docx,.csv" multiple style={{ display: "none" }} onChange={(e) => onFiles(e.target.files)} />
            <button className="btn" onClick={() => fileRef.current?.click()}>{I.up} Upload invoice</button>
            {counts.new > 0 && <button className="btn btn-agent" disabled={bulk} onClick={processAll}>{I.bot} {bulk ? "Processing …" : `Process all ${counts.new}`}</button>}
          </>}
        </header>

        <div className="rl-body">
          {view === "dashboard" ? <Dashboard inv={inv} counts={counts} /> : (
            <div className="split" onDragOver={(e) => { e.preventDefault(); setHot(true); }} onDragLeave={() => setHot(false)} onDrop={(e) => { e.preventDefault(); setHot(false); onFiles(e.dataTransfer.files); }}>
              <div className="panel">
                <div className="panel-h"><h3>{view === "done" ? "Completed" : "Incoming"}</h3><span className="pill">{filtered.length} invoices</span></div>
                {view === "inbox" && (
                  <div className={"drop" + (hot ? " hot" : "")} onClick={() => fileRef.current?.click()}>
                    {I.up}<p><b>Drop a file here</b> or click</p>
                    <div className="or">PDF · PNG/JPG · Word · CSV — the agent reads it automatically</div>
                  </div>
                )}
                <div className="mlist">
                  {filtered.length === 0 && <div style={{ padding: 24, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>Nothing in this view.</div>}
                  {filtered.map((m) => {
                    const tag = FTAG[m.ftype] || FTAG.pdf;
                    return (
                      <div key={m.id} className={"mrow" + (sel === m.id ? " on" : "")} onClick={() => setSel(m.id)}>
                        <div className="mav" style={{ background: m.color }}>{m.from.slice(0, 2).toUpperCase()}</div>
                        <div className="mmeta">
                          <div className="f"><span className="from">{m.from}</span><span className="time">{m.time}</span></div>
                          <div className="subj">{m.subject}</div>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                            <span className="attach">{I.paper}{m.attachment}<span className="ftag" style={{ background: tag.bg, color: tag.c }}>{tag.l}</span></span>
                            <span className={"sbadge s-" + m.status}>{STATUS_LABEL[m.status]}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <Detail inv={selected} onProcess={process} onDecide={decide} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Detail({ inv, onProcess, onDecide }) {
  const [msg, setMsg] = useState(0);
  useEffect(() => { if (!inv?.processing) return; setMsg(0); const t = setInterval(() => setMsg((m) => (m + 1) % SCAN_MSGS.length), 1500); return () => clearInterval(t); }, [inv?.processing]);

  if (!inv) return <div className="panel"><div className="empty">{I.inbox()}<div>Select an invoice</div></div></div>;
  if (inv.processing) return <div className="panel"><div className="scan">
    <div className="doc"><div className="sweep" /><div className="ln" /><div className="ln" /><div className="ln" /><div className="ln" /><div className="ln" /></div>
    <h4>Agent is processing the invoice</h4><p>{SCAN_MSGS[msg]}</p><div className="barwrap"><div className="bar" /></div>
  </div></div>;
  if (!inv.data) return <div className="panel"><div className="empty" style={{ minHeight: 380 }}>
    {I.paper}<div style={{ fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>{inv.from}</div>
    <div style={{ marginBottom: 18, maxWidth: 280 }}>{inv.subject}</div>
    {inv.error && <div className="errbox" style={{ maxWidth: 320 }}>{inv.error}</div>}
    <button className="btn btn-agent" onClick={() => onProcess(inv.id)}>{I.bot} Process with agent</button>
  </div></div>;

  const d = inv.data, r = ROUTING[d.category] || ROUTING["Other"];
  const failed = inv.checks?.some((c) => c.status === "fail");
  const decided = ["approved", "rejected", "review"].includes(inv.status);

  return (
    <div className="panel">
      <div className="dt-head">
        <div className="dt-sup"><div className="k">Supplier</div><h2>{d.supplier || "—"}</h2><div className="addr">{d.supplier_address || ""}</div></div>
        <div className="dt-amt"><div className="big">{fmtEUR(d.gross)}</div><div className="lbl">Invoice total (gross)</div>
          <div style={{ marginTop: 10 }}><span className="cat-chip" style={{ color: r.color, background: r.soft, borderColor: r.border }}>● {d.category}</span></div></div>
      </div>
      <div className="route-bar">{I.route}<span className="t">Agent suggests routing to <span className="dept">{r.dept}</span> · <b>{r.approver}</b> for confirmation</span>
        {d.confidence != null && <span className="confid">Confidence {Math.round(d.confidence * 100)}%</span>}</div>

      <div className="sec-h">Captured data</div>
      <div className="dt-grid">
        <Field k="Invoice number" v={d.invoice_no} mono />
        <Field k="Purchase order" v={d.po_number} mono missing={!d.po_number} />
        <Field k="Invoice date" v={fmtDate(d.invoice_date)} mono />
        <Field k="Due date" v={fmtDate(d.due_date)} mono missing={!d.due_date} />
        <Field k="Net" v={fmtEUR(d.net)} mono />
        <Field k={`VAT (${d.vat_rate != null ? d.vat_rate + "%" : "—"})`} v={fmtEUR(d.vat_amount)} mono />
        <Field k="VAT ID" v={d.vat_id} mono missing={!d.vat_id} />
        <Field k="IBAN" v={d.iban} mono missing={!d.iban} />
      </div>

      {d.line_items?.length > 0 && <>
        <div className="sec-h">Line items</div>
        <div className="items"><table>
          <thead><tr><th>Description</th><th className="num">Qty</th><th className="num">Unit price</th><th className="num">Total</th></tr></thead>
          <tbody>{d.line_items.map((p, i) => <tr key={i}><td>{p.description}</td><td className="num">{p.qty ?? "—"}</td><td className="num">{p.unit_price != null ? fmtEUR(p.unit_price) : "—"}</td><td className="num">{p.total != null ? fmtEUR(p.total) : "—"}</td></tr>)}</tbody>
        </table></div>
      </>}

      <div className="sec-h">Automatic checks</div>
      <div className="checks">{inv.checks?.map((c, i) => (
        <div key={i} className={"chk " + c.status}><span className="ico">{c.status === "pass" ? I.check : c.status === "warn" ? I.warn : I.x}</span>
          <div><div className="ct2">{c.label}</div>{c.detail && <div className="cd">{c.detail}</div>}</div></div>
      ))}</div>

      <div className="actions">
        {decided ? (
          <div style={{ fontSize: 13, fontWeight: 600, color: inv.status === "approved" ? "var(--ok)" : inv.status === "rejected" ? "var(--bad)" : "var(--warn)" }}>
            {inv.status === "approved" ? `✓ Approved — handed to ${r.dept}` : inv.status === "rejected" ? "✕ Rejected — returned to supplier" : "● Flagged for review"}
            <button className="btn" style={{ marginLeft: 12 }} onClick={() => onDecide(inv.id, "checked")}>Undo</button>
          </div>
        ) : <>
          <button className="btn btn-ok" onClick={() => onDecide(inv.id, "approved")}>{I.check} Approve & post</button>
          <button className="btn btn-warn" onClick={() => onDecide(inv.id, "review")}>{I.warn} Flag for review</button>
          <button className="btn btn-bad" onClick={() => onDecide(inv.id, "rejected")}>{I.x} Reject</button>
          <span className="note">{failed ? "⚠ Checks found something — please review before approving." : `Needs sign-off from ${r.dept}`}</span>
        </>}
      </div>
    </div>
  );
}

function Field({ k, v, mono, missing }) {
  return <div className="field"><span className="fk">{k}</span><span className={"fv" + (mono ? " mono" : "") + (missing ? " miss" : "")}>{missing && !v ? "not stated" : (v ?? "—")}</span></div>;
}

function Dashboard({ inv, counts }) {
  const processed = inv.filter((i) => i.data);
  const total = processed.reduce((s, i) => s + (i.data.gross || 0), 0);
  const byCat = {};
  processed.forEach((i) => { const k = i.data.category || "Other"; byCat[k] = (byCat[k] || 0) + (i.data.gross || 0); });
  const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...cats.map((c) => c[1]));
  const recent = processed.slice(0, 7);
  const dotColor = (s) => s === "approved" ? "var(--ok)" : s === "rejected" ? "var(--bad)" : s === "review" ? "var(--warn)" : "var(--agent)";

  return <>
    <div className="stats">
      <div className="stat"><div className="ic" style={{ background: "var(--agent-soft)", color: "var(--agent)" }}>{I.inbox("currentColor")}</div><div className="v">{inv.length}</div><div className="l">Invoices total</div></div>
      <div className="stat"><div className="ic" style={{ background: "#EAEEF6", color: "#566177" }}>{I.clock}</div><div className="v">{counts.new + counts.checked + counts.review}</div><div className="l">Still open</div></div>
      <div className="stat"><div className="ic" style={{ background: "var(--ok-soft)", color: "var(--ok)" }}>{I.check}</div><div className="v">{counts.approved}</div><div className="l">Approved</div></div>
      <div className="stat"><div className="ic" style={{ background: "#E9EEFC", color: "var(--primary)" }}>{I.euro}</div><div className="v" style={{ fontSize: 21 }}>{fmtEUR(total)}</div><div className="l">Value captured</div></div>
    </div>
    <div className="dash-grid">
      <div className="panel">
        <div className="panel-h"><h3>Value by category</h3><span className="pill">{cats.length} categories</span></div>
        {cats.length === 0 ? <div style={{ padding: 22, color: "var(--muted)", fontSize: 13 }}>No invoices processed yet.</div> :
          cats.map(([name, amt]) => { const r = ROUTING[name] || ROUTING["Other"]; return (
            <div key={name} className="catrow"><span className="nm">{name}</span><span className="track"><span className="fill" style={{ width: (amt / max * 100) + "%", background: r.color }} /></span><span className="amt">{fmtEUR(amt)}</span></div>
          ); })}
      </div>
      <div className="panel">
        <div className="panel-h"><h3>Activity</h3></div>
        {recent.length === 0 ? <div style={{ padding: 22, color: "var(--muted)", fontSize: 13 }}>No activity yet.</div> :
          recent.map((i) => (
            <div key={i.id} className="act"><span className="d" style={{ background: dotColor(i.status) }} />
              <span className="tx"><b>{i.data.supplier || i.from}</b> · {fmtEUR(i.data.gross)} → {(ROUTING[i.data.category] || ROUTING.Other).dept}</span>
              <span className="tm">{STATUS_LABEL[i.status]}</span></div>
          ))}
      </div>
    </div>
  </>;
}
