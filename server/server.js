const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const axios = require('axios');
const scrapeJorudan = require('./services/jorudan');

const app = express();
const PORT = 3000;

app.use(cors());

const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  message: { error: 'Too many requests, please slow down.' }
});
app.use('/scrape', limiter);

app.get('/scrape', async (req, res) => {
  console.log(`[SCRAPE] Incoming: ${req.protocol}://${req.headers.host}${req.originalUrl}`);
  const raw = req.query;
  const params = {
    year: raw.year,
    month: raw.month,
    day: raw.day,
    hour: raw.hour,
    minute: raw.minute,
    departOrArrive: raw.departOrArrive || 'departure',
    paymentType: raw.paymentType || 'ic',
    discountType: raw.discountType || 'none',
    commuteType: raw.commuteType || 'commute',
    airplaneUse: raw.airplaneUse || 'forbid',
    busUse: raw.busUse || 'forbid',
    expressTrainUse: raw.expressTrainUse || 'allow',
    allowCarTaxi: raw.allowCarTaxi || 'true',
    allowBike: raw.allowBike || 'true',
    sort: raw.sort || 'recommend',
    seatPreference: raw.seatPreference || 'any',
    preferredTrain: raw.preferredTrain || 'nozomi',
    transferTime: raw.transferTime || 'normal',
    searchType: raw.searchType || '1',
    from: raw.from,
    to: raw.to,
    departure: raw.departure
  };

  if (!params.from || !params.to || !params.year || !params.month || !params.day || !params.hour || !params.minute) {
    res.status(400).send('Erreur: paramètres manquants');
    return;
  }
  try {
    const results = await scrapeJorudan(params);
    res.json({ results });
  } catch (error) {
    console.error(`[SCRAPE] Error: ${error.message}`);
    res.status(500).send('Erreur scraping');
  }
});

app.get('/suggest', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) {
    res.status(400).json({ error: 'Missing q parameter' });
    return;
  }
  try {
    const url = `https://navi.jorudan.co.jp/api/compat/suggest/agg?lang=ja&limit=1&q=${encodeURIComponent(q)}`;
    const { data } = await axios.get(url);
    res.json(data);
  } catch (err) {
    console.error('[SUGGEST_PROXY]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
