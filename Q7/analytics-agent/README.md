# ALK Customer Analytics Agent — Problem 7
## Dr. Theiss Naturwaren GmbH / Allgäuer Latschenkiefer

### What this does
A working prototype that ingests customer transaction data, computes behavioural patterns, and generates targeting signals using Gemini 2.5 Flash Lite.

### Three modules:
1. **Ingest & Analyse** — Upload your CSV (or use sample data). Computes RFM segmentation, season signals per SKU, and gets AI behavioural insights from Gemini.
2. **Targeting Signals** — Pick a segment + SKU, get a targeting signal card: headline (German), targeting criteria, best send window, channel priority, message angle.
3. **Sales Lift** — Select a SKU to measure post-campaign lift (treatment vs control period split), with Gemini interpretation.

### Running it
```bash
npm install
node server.js
# Open http://localhost:3000
# Enter your Gemini API key in the UI
```

### CSV format
```
customer_id,sku,date,qty,channel,price,weather,region
C001,ALK-FB-03,2024-03-15,2,pharmacy,6.99,warm,Bayern
```
Download sample from the UI or at /api/sample-csv

### Architecture
- **Backend** (Node.js/Express): CSV parsing, RFM computation, season signal extraction, lift calculation
- **Gemini calls**: Made directly from the browser (avoids server-side network restrictions)
- **Model**: gemini-2.5-flash-lite

### API endpoints
- POST /api/analyze — ingest CSV, returns RFM + segments + season signals
- POST /api/lift — sales lift for a given SKU  
- GET /api/sample-csv — download sample transaction CSV
