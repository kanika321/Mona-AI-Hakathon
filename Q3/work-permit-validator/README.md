# Work Permit Validator — Prototype

For Leistenschneider Personaldienstleistungen GmbH. Upload a PDF, get back:
- whether it's a valid work permit (yes/no)
- a confidence percentage
- the date it's valid until

Uses Google's Gemini 2.5 Flash Lite to read the PDF directly (no OCR step needed — it's multimodal).

## Project structure
```
work-permit-validator/
  backend/    Node.js + Express API that calls Gemini
  frontend/   React (Vite) upload UI
```

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

It runs on `http://localhost:4000`.

## 2. Frontend setup

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the URL it prints (usually `http://localhost:5173`). The frontend automatically forwards `/api` calls to the backend.

## How it works

1. You drop/select a PDF in the browser.
2. The frontend sends it to the backend (`POST /api/validate-permit`).
3. The backend sends the raw PDF bytes to Gemini 2.5 Flash Lite along with instructions to check whether it's a genuine work/residence permit, with a structured JSON response forced via `responseSchema`.
4. The backend forwards Gemini's answer straight to the UI: valid/invalid, confidence %, expiry date, and a one-line reason.

## Testing

Once you have your 4 sample PDFs (2 valid, 2 invalid work permits), just upload them one at a time through the UI and check the result against what you'd expect. No Postman, no terminal needed to use the tool itself — that's only needed once for the initial `npm install` setup.

## Notes / known limits (intentional, for a hackathon prototype)
- One file at a time — no batch upload or history log.
- No database — results aren't stored anywhere, each check is stateless.
- No auth — fine for local demo, would need adding before any real deployment.
- Files are temporarily written to `backend/uploads/` during processing and deleted immediately after.
