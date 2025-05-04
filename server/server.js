const express = require('express');
const cors    = require('cors');
const axios   = require('axios');
const scrapeJorudan = require('./services/jorudan');

const app = express();
app.use(cors());
const PORT = 3000;

app.get('/scrape', async (req, res) => {
  console.log(`[SCRAPE] Incoming: ${req.method} ${req.originalUrl}`);
  console.log('[SCRAPE] Query params:', req.query);
  const { from, to, year, month, day, hour, minute } = req.query;
  if (!from || !to || !year || !month || !day || !hour || !minute) {
    return res.status(400).send('Erreur: paramètres manquants');
  }
  try {
    const results = await scrapeJorudan(req.query);
    res.json({ results });
  } catch (error) {
    console.error(`[SCRAPE] Error: ${error.message}`);
    res.status(500).send('Erreur scraping');
  }
});

app.get('/suggest', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) {
    return res.status(400).json({ error: 'Missing q parameter' });
  }
  try {
    const url = `https://navi.jorudan.co.jp/api/compat/suggest/agg`
              + `?lang=ja&limit=1&q=${encodeURIComponent(q)}`;
    const { data } = await axios.get(url);
    res.json(data);
  } catch (err) {
    console.error('[SUGGEST_PROXY] ', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
