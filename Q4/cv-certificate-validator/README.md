# CV & Certificate Validator — Prototype

For Persowerk Deutschland GmbH. Upload a candidate's CV or a certificate, and get back:
- whether the document actually matches what you said it is (CV vs certificate)
- an authenticity score, and a Low / Medium / High risk that it's AI-generated or fabricated
- for certificates specifically: whether it's currently valid, and the expiry date
- a list of concrete red flags the model noticed (if any)

Uses Google's Gemini 2.5 Flash Lite, which reads PDFs and images directly (no OCR step needed).

## Project structure
```
cv-certificate-validator/
  backend/    Node.js + Express API that calls Gemini
  frontend/   React (Vite) upload UI
```

Note: this runs on different ports (backend 4001, frontend 5174) than the work-permit-validator project, so the two can run side by side without clashing.

## 1. Backend setup

```bash
cd backend
npm install
cp .env.example .env
```

Open `.env` and paste in your Gemini API key (get one free at https://aistudio.google.com/apikey):

```
GEMINI_API_KEY=your_real_key_here
```

Start the backend:

```bash
npm start
```

It runs on `http://localhost:4001`.

## 2. Frontend setup

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the URL it prints — usually `http://localhost:5174`.

## How it works

1. You pick "CV / Resume" or "Certificate" with the toggle, then drop/select the file.
2. The frontend sends it to the backend (`POST /api/validate-document`) along with which type you selected.
3. The backend sends the raw file bytes to Gemini 2.5 Flash Lite with a prompt tailored to that document type:
   - **CV**: looks for generic/AI-typical phrasing, implausible skill combinations, overlapping employment dates, unverifiable claims.
   - **Certificate**: checks for genuine-looking formatting/seals/issuing details, and compares any expiry date to today's date to confirm current validity.
4. The result — including an authenticity score and any red flags — is sent straight back to the UI.

## Supported file types

PDF, JPG/JPEG, PNG, WEBP, and HEIC/HEIF — these are the formats Gemini can read directly. Word documents (.doc/.docx) aren't supported in this prototype; if that's needed for the next round, it would need a conversion step before sending to the model.

## Testing

Upload a few real (or deliberately AI-generated/altered) CVs and certificates one at a time and sanity-check the verdict against what you'd expect.

## Notes / known limits (intentional, for a hackathon prototype)
- One file at a time — no batch upload or history log.
- No database — nothing is stored, each check is stateless.
- No auth — fine for local demo, would need adding before any real deployment.
- This flags *risk signals*, not certainty — it's a triage tool to focus human review, not a definitive fraud verdict.
- Files are temporarily written to `backend/uploads/` during processing and deleted immediately after.
