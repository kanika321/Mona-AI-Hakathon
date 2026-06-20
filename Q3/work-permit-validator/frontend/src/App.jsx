import { useState, useRef } from 'react';

const API_URL = '/api/validate-permit';

function ResultCard({ result }) {
  const isValid = result.is_work_permit;
  const confidence = Math.round(result.confidence_percentage);
  const validUntil =
    result.valid_until_date && result.valid_until_date !== 'null'
      ? result.valid_until_date
      : 'Not found';

  return (
    <div className={`result-card ${isValid ? 'valid' : 'invalid'}`}>
      <div className="result-header">
        <span className="result-icon">{isValid ? '✅' : '❌'}</span>
        <h2>{isValid ? 'Valid Work Permit' : 'Not a Valid Work Permit'}</h2>
      </div>

      <div className="confidence-row">
        <span>Confidence</span>
        <div className="confidence-bar-track">
          <div className="confidence-bar-fill" style={{ width: `${confidence}%` }} />
        </div>
        <span className="confidence-value">{confidence}%</span>
      </div>

      <div className="detail-row">
        <span className="detail-label">Document type detected</span>
        <span>{result.document_type_detected || '—'}</span>
      </div>

      <div className="detail-row">
        <span className="detail-label">Valid until</span>
        <span>{validUntil}</span>
      </div>

      <p className="reasoning">{result.reasoning}</p>
    </div>
  );
}

export default function App() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const selectFile = (f) => {
    if (!f) return;
    if (f.type !== 'application/pdf') {
      setError('Please upload a PDF file.');
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
        <h1>Work Permit Validator</h1>
        <p className="subtitle">Leistenschneider Personaldienstleistungen GmbH</p>
      </header>

      <main>
        <div
          className="dropzone"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => inputRef.current.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            onChange={handleFileChange}
            hidden
          />
          {file ? (
            <p className="filename">📄 {file.name}</p>
          ) : (
            <p>Drag &amp; drop a work permit PDF here, or click to choose a file</p>
          )}
        </div>

        <div className="actions">
          <button onClick={handleValidate} disabled={!file || loading}>
            {loading ? 'Validating…' : 'Validate Permit'}
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
