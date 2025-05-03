const express = require('express');
const cors = require('cors');
const scrapeJorudan = require('./services/jorudan');

const app = express();
app.use(cors());
const PORT = 3000;

app.get('/scrape', async (req, res) => {
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

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
