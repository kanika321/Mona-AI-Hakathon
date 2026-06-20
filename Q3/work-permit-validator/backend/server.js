require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Ensure the temp upload folder exists
const UPLOAD_DIR = path.join(__dirname, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const upload = multer({ dest: UPLOAD_DIR });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.5-flash-lite';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

const PROMPT = `You are a document validation assistant for a German staffing agency (Personaldienstleistungen) that places international candidates with employers in Germany.

Analyze the attached PDF document and determine:
1. Whether this document is a genuine work permit / residence-and-work-authorization document (e.g. German "Aufenthaltstitel" with work authorization, "Arbeitserlaubnis", EU Blue Card, work visa, or an equivalent official work authorization document from any country).
2. How confident you are in that assessment, as a percentage from 0 to 100.
3. The date until which the permit is valid (expiry date), in YYYY-MM-DD format if it can be determined. If no expiry date is present, return the string "null".
4. A short, one-to-two sentence explanation of your reasoning, mentioning the key features (or red flags) that informed your decision.

Be strict: only classify a document as a valid work permit if it clearly contains the structural and textual features of an official work/residence permit (issuing authority, permit holder name, document/permit number, validity dates, permit type). Reject documents that are unrelated (e.g. plain passports, payslips, contracts, blank or scrambled pages) or that look fabricated or internally inconsistent (e.g. expiry date before issue date, mismatched names, missing official markings).

Respond only with the JSON object matching the required schema, nothing else.`;

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    is_work_permit: { type: 'BOOLEAN' },
    confidence_percentage: { type: 'NUMBER' },
    valid_until_date: { type: 'STRING' },
    document_type_detected: { type: 'STRING' },
    reasoning: { type: 'STRING' },
  },
  required: [
    'is_work_permit',
    'confidence_percentage',
    'valid_until_date',
    'document_type_detected',
    'reasoning',
  ],
};

app.post('/api/validate-permit', upload.single('document'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded. Field name must be "document".' });
  }

  if (!GEMINI_API_KEY) {
    fs.unlink(req.file.path, () => {});
    return res.status(500).json({
      error: 'Server is missing GEMINI_API_KEY. Add it to backend/.env (copy .env.example).',
    });
  }

  try {
    const fileBuffer = fs.readFileSync(req.file.path);
    const base64Data = fileBuffer.toString('base64');

    const requestBody = {
      contents: [
        {
          parts: [
            { text: PROMPT },
            {
              inline_data: {
                mime_type: 'application/pdf',
                data: base64Data,
              },
            },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
      },
    };

    const geminiRes = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    const geminiData = await geminiRes.json();

    // Clean up the temp file regardless of outcome
    fs.unlink(req.file.path, () => {});

    if (!geminiRes.ok) {
      console.error('Gemini API error:', JSON.stringify(geminiData));
      return res.status(502).json({ error: 'Gemini API request failed.', details: geminiData });
    }

    const textPart = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textPart) {
      return res.status(502).json({ error: 'Unexpected response shape from Gemini API.', details: geminiData });
    }

    let result;
    try {
      result = JSON.parse(textPart);
    } catch (e) {
      return res.status(502).json({ error: 'Could not parse Gemini response as JSON.', raw: textPart });
    }

    return res.json({
      fileName: req.file.originalname,
      ...result,
    });
  } catch (err) {
    console.error(err);
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(500).json({ error: 'Internal server error.', details: err.message });
  }
});

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
