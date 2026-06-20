require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const UPLOAD_DIR = path.join(__dirname, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const upload = multer({ dest: UPLOAD_DIR });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.5-flash-lite';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

// Gemini's multimodal input only accepts these document/image types directly.
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
];

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    document_type_detected: { type: 'STRING' },
    matches_expected_type: { type: 'BOOLEAN' },
    authenticity_score: { type: 'NUMBER' },
    ai_generated_risk: { type: 'STRING' }, // "Low" | "Medium" | "High"
    is_currently_valid: { type: 'STRING' }, // "Yes" | "No" | "Not Applicable"
    valid_until_date: { type: 'STRING' }, // YYYY-MM-DD or "null"
    red_flags: { type: 'ARRAY', items: { type: 'STRING' } },
    summary: { type: 'STRING' },
  },
  required: [
    'document_type_detected',
    'matches_expected_type',
    'authenticity_score',
    'ai_generated_risk',
    'is_currently_valid',
    'valid_until_date',
    'red_flags',
    'summary',
  ],
};

function buildPrompt(docType) {
  const today = new Date().toISOString().slice(0, 10);

  if (docType === 'certificate') {
    return `You are a fraud-detection and validity-checking assistant for a German staffing agency (Personaldienstleistungen) reviewing candidate certificates (training certificates, qualifications, licenses, diplomas) for authenticity and current validity.

Analyze the attached document and determine:
1. Whether it is in fact a certificate/qualification/license document (matches_expected_type).
2. An authenticity score from 0-100 representing how likely this is a genuine, unaltered certificate (vs fabricated, templated, or visibly edited).
3. The risk that this certificate is AI-generated or fabricated: "Low", "Medium", or "High". Look for inconsistent fonts, misaligned seals/signatures/logos, generic or missing issuing-body details, implausible certificate numbers, or layouts that don't match known real-world certificate formats.
4. Whether the certificate is CURRENTLY valid. Today's date is ${today}. Compare any expiry/valid-until date found on the document to today. Set is_currently_valid to "Yes" if still valid, "No" if expired, or "Not Applicable" if the document has no expiry date (e.g. a permanent qualification/diploma).
5. The expiry / valid-until date in YYYY-MM-DD format if present on the document, otherwise the string "null".
6. A list of concrete red flags you noticed, if any (can be an empty array if none).
7. A one-to-two sentence overall summary of your assessment.

Respond only with the JSON object matching the schema, nothing else.`;
  }

  // default: CV / resume
  return `You are a fraud-detection assistant for a German staffing agency (Personaldienstleistungen) reviewing candidate CVs/resumes for signs of AI-generation or fabrication.

Analyze the attached document and determine:
1. Whether it is in fact a CV/resume document (matches_expected_type).
2. An authenticity score from 0-100 representing how likely this is a genuine, accurately self-reported CV (vs largely fabricated or substantially exaggerated).
3. The risk that this CV was substantially written or fabricated by an AI tool rather than reflecting the candidate's authentic history: "Low", "Medium", or "High". Look for generic buzzword-heavy phrasing typical of AI writing, unrealistic combinations of skills/seniority for the apparent experience level, overlapping or implausible employment dates, vague/unverifiable company names, suspiciously uniform phrasing and structure across every section, or achievements stated with no concrete specifics.
4. This document is a CV, not a certificate, so set is_currently_valid to "Not Applicable" and valid_until_date to "null".
5. A list of concrete red flags you noticed, if any (can be an empty array if none).
6. A one-to-two sentence overall summary of your assessment, including a brief note on the plausibility of the candidate's stated work history.

Respond only with the JSON object matching the schema, nothing else.`;
}

app.post('/api/validate-document', upload.single('document'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded. Field name must be "document".' });
  }

  const docType = req.body.docType === 'certificate' ? 'certificate' : 'cv';

  if (!ALLOWED_MIME_TYPES.includes(req.file.mimetype)) {
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({
      error: `Unsupported file type "${req.file.mimetype}". Supported formats: PDF, JPG, PNG, WEBP, HEIC.`,
    });
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
            { text: buildPrompt(docType) },
            {
              inline_data: {
                mime_type: req.file.mimetype,
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
      requestedType: docType,
      ...result,
    });
  } catch (err) {
    console.error(err);
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.status(500).json({ error: 'Internal server error.', details: err.message });
  }
});

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 4001;
app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
