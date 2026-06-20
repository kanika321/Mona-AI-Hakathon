import { useState, useRef } from 'react';

const API_URL = '/api/validate-document';
const ACCEPTED_TYPES = ['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'];

function riskColor(risk) {
  if (risk === 'Low') return 'risk-low';
  if (risk === 'Medium') return 'risk-medium';
  return 'risk-high';
}

function verdict(result) {
  if (!result.matches_expected_type) {
    return { icon: '⚠️', label: `Doesn't look like a ${result.requestedType === 'certificate' ? 'certificate' : 'CV'}`, cls: 'medium' };
  }
  if (result.ai_generated_risk === 'High' || result.authenticity_score < 40) {
    return { icon: '❌', label: 'High Fraud Risk', cls: 'invalid' };
  }
  if (result.ai_generated_risk === 'Medium' || result.authenticity_score < 75) {
    return { icon: '⚠️', label: 'Needs Manual Review', cls: 'medium' };
  }
  return { icon: '✅', label: 'Looks Genuine', cls: 'valid' };
}

function ResultCard({ result }) {
  const v = verdict(result);
  const score = Math.round(result.authenticity_score);
  const showValidity = result.requestedType === 'certificate';

  return (
    <div className={`result-card ${v.cls}`}>
      <div className="result-header">
        <span className="result-icon">{v.icon}</span>
        <h2>{v.label}</h2>
      </div>

      <div className="confidence-row">
        <span>Authenticity score</span>
        <div className="confidence-bar-track">
          <div className="confidence-bar-fill" style={{ width: `${score}%` }} />
        </div>
        <span className="confidence-value">{score}%</span>
      </div>

      <div className="detail-row">
        <span className="detail-label">Document type detected</span>
        <span>{result.document_type_detected || '—'}</span>
      </div>

      <div className="detail-row">
        <span className="detail-label">AI-generated / fabrication risk</span>
        <span className={`risk-badge ${riskColor(result.ai_generated_risk)}`}>{result.ai_generated_risk}</span>
      </div>

      {showValidity && (
        <>
          <div className="detail-row">
            <span className="detail-label">Currently valid</span>
            <span>{result.is_currently_valid}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Valid until</span>
            <span>{result.valid_until_date && result.valid_until_date !== 'null' ? result.valid_until_date : 'Not found'}</span>
          </div>
        </>
      )}

      {result.red_flags && result.red_flags.length > 0 && (
        <div className="red-flags">
          <span className="detail-label">Red flags</span>
          <ul>
            {result.red_flags.map((flag, i) => (
              <li key={i}>{flag}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="reasoning">{result.summary}</p>
    </div>
  );
}

export default function App() {
  const [docType, setDocType] = useState('cv');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const selectFile = (f) => {
    if (!f) return;
    const ext = '.' + f.name.split('.').pop().toLowerCase();
    if (!ACCEPTED_TYPES.includes(ext)) {
      setError(`Unsupported file type. Accepted: ${ACCEPTED_TYPES.join(', ')}`);
      return;
    }
    setFile(f);
    setResult(null);
    setError(null);
  };

  const handleFileChange = (e) => selectFile(e.target.files[0]);

  const handleDrop = (e) => {
    e.preventDefault();
    selectFile(e.dataTransfer.files[0]);
  };

  const handleValidate = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append('document', file);
    formData.append('docType', docType);

    try {
      const res = await fetch(API_URL, { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Validation failed.');
      }
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="page">
      <header>
        <h1>CV &amp; Certificate Validator</h1>
        <p className="subtitle">Persowerk Deutschland GmbH</p>
      </header>

      <main>
        <div className="type-toggle">
          <button
            className={docType === 'cv' ? 'toggle-btn active' : 'toggle-btn'}
            onClick={() => { setDocType('cv'); reset(); }}
          >
            CV / Resume
          </button>
          <button
            className={docType === 'certificate' ? 'toggle-btn active' : 'toggle-btn'}
            onClick={() => { setDocType('certificate'); reset(); }}
          >
            Certificate
          </button>
        </div>

        <div
          className="dropzone"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => inputRef.current.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(',')}
            onChange={handleFileChange}
            hidden
          />
          {file ? (
            <p className="filename">📄 {file.name}</p>
          ) : (
            <p>
              Drag &amp; drop a {docType === 'cv' ? 'CV' : 'certificate'} here, or click to choose a file
              <br />
              <span className="hint">PDF, JPG, PNG, WEBP, or HEIC</span>
            </p>
          )}
        </div>

        <div className="actions">
          <button onClick={handleValidate} disabled={!file || loading}>
            {loading ? 'Analyzing…' : 'Validate Document'}
          </button>
          {(file || result) && (
            <button className="secondary" onClick={reset}>
              Clear
            </button>
          )}
        </div>

        {error && <div className="error-box">{error}</div>}
        {result && <ResultCard result={result} />}
      </main>
    </div>
  );
}
