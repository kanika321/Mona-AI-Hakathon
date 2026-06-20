const express = require('express');
const cors = require('cors');
const multer = require('multer');
const Papa = require('papaparse');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());
const upload = multer({ dest: 'uploads/' });

const PRODUCT_CATALOGUE = {
  'ALK-FB-01': { name: 'Fuß Butter', line: 'Feet', segment: '45+ dry-skin, women', peak: 'Autumn–Winter' },
  'ALK-FB-02': { name: 'Sole Fußbad', line: 'Feet', segment: 'Wellness, 50+', peak: 'Winter' },
  'ALK-FB-03': { name: 'Hornhaut Reduziercreme', line: 'Feet', segment: 'Women 30–60', peak: 'Spring (sandal prep)' },
  'ALK-FB-04': { name: 'Hornhaut Entferner Maske', line: 'Feet', segment: 'Women 25–45', peak: 'Spring–Summer' },
  'ALK-FB-05': { name: '10% Urea Fußcreme', line: 'Feet', segment: 'Diabetic / very dry skin', peak: 'All year' },
  'ALK-FB-06': { name: 'Fußpflege Deospray', line: 'Feet', segment: 'Active / men 20–45', peak: 'Summer' },
  'ALK-LG-01': { name: '5 in 1 Beinlotion', line: 'Legs', segment: 'Women 35–65', peak: 'Summer' },
  'ALK-LG-02': { name: 'Bein Frische Gel', line: 'Legs', segment: 'Travel / standing jobs', peak: 'Summer' },
  'ALK-LG-03': { name: 'Besenreiser Pflegebalsam', line: 'Legs', segment: 'Women 40–65', peak: 'Spring–Summer' },
  'ALK-MG-01': { name: 'Mobil Gel', line: 'Muscles/Joints', segment: 'Active 30+, 55+ joints', peak: 'Autumn–Winter' },
  'ALK-MG-02': { name: 'Mobil Einreibung Extra Stark', line: 'Muscles/Joints', segment: 'Sport, 25–55', peak: 'Winter / sport' },
  'ALK-MG-03': { name: 'Mobil Eisspray akut', line: 'Muscles/Joints', segment: 'Athletes, teams', peak: 'Sport season' },
  'ALK-MG-04': { name: 'Franzbranntwein', line: 'Muscles/Joints', segment: 'Traditional 55+', peak: 'All year' },
  'ALK-MG-05': { name: 'Wärmendes Intensiv Gel', line: 'Muscles/Joints', segment: '45+ tension/back', peak: 'Winter' },
  'ALK-CB-01': { name: 'Ur Bonbons', line: 'Cough drops', segment: 'Mass-market', peak: 'Cold season' },
};

function computeRFM(transactions) {
  const now = new Date('2025-01-01');
  const customerMap = {};
  for (const tx of transactions) {
    const cid = tx.customer_id;
    if (!customerMap[cid]) customerMap[cid] = { transactions: [], totalSpend: 0 };
    customerMap[cid].transactions.push(tx);
    customerMap[cid].totalSpend += parseFloat(tx.price || 0) * parseInt(tx.qty || 1);
  }
  const rfm = [];
  for (const [cid, data] of Object.entries(customerMap)) {
    const dates = data.transactions.map(t => new Date(t.date)).sort((a, b) => b - a);
    const recencyDays = Math.round((now - dates[0]) / (1000 * 60 * 60 * 24));
    const frequency = data.transactions.length;
    const monetary = Math.round(data.totalSpend * 100) / 100;
    const lineCounts = {};
    for (const tx of data.transactions) {
      const product = PRODUCT_CATALOGUE[tx.sku];
      if (product) lineCounts[product.line] = (lineCounts[product.line] || 0) + 1;
    }
    const topLine = Object.entries(lineCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown';
    const months = data.transactions.map(t => new Date(t.date).getMonth() + 1);
    const seasonMap = { Spring: [3,4,5], Summer: [6,7,8], Autumn: [9,10,11], Winter: [12,1,2] };
    const seasonCounts = {};
    for (const m of months) {
      for (const [s, ms] of Object.entries(seasonMap)) {
        if (ms.includes(m)) seasonCounts[s] = (seasonCounts[s] || 0) + 1;
      }
    }
    const topSeason = Object.entries(seasonCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'All year';
    rfm.push({ customer_id: cid, recency_days: recencyDays, frequency, monetary, top_line: topLine, top_season: topSeason,
      skus_purchased: [...new Set(data.transactions.map(t => t.sku))] });
  }
  return rfm.sort((a, b) => a.recency_days - b.recency_days);
}

function segmentCustomers(rfmData) {
  const segments = { Champions: [], LoyalCustomers: [], AtRisk: [], NewCustomers: [], Hibernating: [] };
  for (const c of rfmData) {
    if (c.recency_days < 60 && c.frequency >= 3) segments.Champions.push(c);
    else if (c.recency_days < 120 && c.frequency >= 2) segments.LoyalCustomers.push(c);
    else if (c.recency_days < 180 && c.frequency >= 2) segments.AtRisk.push(c);
    else if (c.frequency === 1 && c.recency_days < 90) segments.NewCustomers.push(c);
    else segments.Hibernating.push(c);
  }
  return segments;
}

function computeSeasonSignals(transactions) {
  const skuMonths = {};
  for (const tx of transactions) {
    const month = new Date(tx.date).getMonth() + 1;
    if (!skuMonths[tx.sku]) skuMonths[tx.sku] = {};
    skuMonths[tx.sku][month] = (skuMonths[tx.sku][month] || 0) + parseInt(tx.qty || 1);
  }
  const signals = [];
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  for (const [sku, months] of Object.entries(skuMonths)) {
    const product = PRODUCT_CATALOGUE[sku];
    if (!product) continue;
    const peakMonth = Object.entries(months).sort((a, b) => b[1] - a[1])[0];
    signals.push({ sku, product_name: product.name, line: product.line, target_segment: product.segment,
      peak_send_month: monthNames[peakMonth[0] - 1], declared_peak: product.peak, volume_at_peak: peakMonth[1] });
  }
  return signals.sort((a, b) => b.volume_at_peak - a.volume_at_peak);
}

function simulateSalesLift(transactions, sku) {
  const skuTxs = transactions.filter(t => t.sku === sku);
  if (skuTxs.length < 2) return null;
  const sorted = skuTxs.sort((a, b) => new Date(a.date) - new Date(b.date));
  const mid = Math.floor(sorted.length / 2);
  const control = sorted.slice(0, mid);
  const treatment = sorted.slice(mid);
  const controlAvg = control.reduce((s, t) => s + parseInt(t.qty || 1), 0) / control.length;
  const treatmentAvg = treatment.reduce((s, t) => s + parseInt(t.qty || 1), 0) / treatment.length;
  const lift = ((treatmentAvg - controlAvg) / controlAvg) * 100;
  return {
    sku, product: PRODUCT_CATALOGUE[sku]?.name,
    control_period_avg_qty: Math.round(controlAvg * 100) / 100,
    treatment_period_avg_qty: Math.round(treatmentAvg * 100) / 100,
    estimated_lift_pct: Math.round(lift * 10) / 10,
    control_n: control.length, treatment_n: treatment.length
  };
}

// Analytics endpoint (NO Gemini — returns raw data, browser calls Gemini)
app.post('/api/analyze', upload.single('file'), async (req, res) => {
  try {
    let transactions;
    if (req.file) {
      const content = fs.readFileSync(req.file.path, 'utf8');
      const parsed = Papa.parse(content, { header: true, skipEmptyLines: true });
      transactions = parsed.data;
      fs.unlinkSync(req.file.path);
    } else if (req.body.use_sample) {
      const content = fs.readFileSync('./sample_transactions.csv', 'utf8');
      const parsed = Papa.parse(content, { header: true, skipEmptyLines: true });
      transactions = parsed.data;
    } else {
      return res.status(400).json({ error: 'No file or use_sample flag' });
    }
    const rfm = computeRFM(transactions);
    const segments = segmentCustomers(rfm);
    const season_signals = computeSeasonSignals(transactions);
    res.json({ success: true, analytics: { transaction_count: transactions.length, customer_count: rfm.length, rfm, segments, season_signals } });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Sales lift endpoint (no Gemini)
app.post('/api/lift', upload.none(), async (req, res) => {
  try {
    const { sku } = req.body;
    if (!sku) return res.status(400).json({ error: 'sku required' });
    const content = fs.readFileSync('./sample_transactions.csv', 'utf8');
    const parsed = Papa.parse(content, { header: true, skipEmptyLines: true });
    const lift = simulateSalesLift(parsed.data, sku);
    if (!lift) return res.status(404).json({ error: 'Not enough data for this SKU' });
    res.json({ success: true, lift_result: lift });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/health', (_, res) => res.json({ status: 'ok' }));
app.get('/api/sample-csv', (_, res) => {
  res.setHeader('Content-Disposition', 'attachment; filename=sample_transactions.csv');
  res.setHeader('Content-Type', 'text/csv');
  res.send(fs.readFileSync('./sample_transactions.csv', 'utf8'));
});
app.use(express.static('public'));

const PORT = 3000;
app.listen(PORT, () => console.log(`Running on http://localhost:${PORT}`));
