# ジョルダン旅

**ジョルダン旅** is a train itinerary planning app that scrapes and parses data from [Jorudan.co.jp](https://www.jorudan.co.jp/) to build detailed, multi-leg Japanese railway journeys in a clean custom UI.

## Stack

* **Frontend**: jQuery, Flatpickr, Vanilla JS, CSS (no framework)
* **Backend**: Node.js + Express
* **Scraper**: Axios + Cheerio targeting Jorudan’s desktop site
* **Data**: Direct HTML parsing (no public API)
* **Hosting**: Localhost / deploy-ready on any Node-compatible host

## Usage

1. Start backend:

   ```bash
   node index.js
   ```

2. Open `index.html` in a browser (or serve via any static server).

## Endpoints

```
GET /scrape
```

Scrapes itineraries based on:

* Required: `from`, `to`, `year`, `month`, `day`, `hour`, `minute`
* Optional: `departOrArrive`, `paymentType`, `discountType`, `commuteType`, `airplaneUse`, `busUse`, `expressTrainUse`, `allowCarTaxi`, `allowBike`, `sort`, `seatPreference`, `preferredTrain`, `transferTime`, `searchType`, `departure`

Returns structured results or `correction` / `notification` field.

```
GET /suggest?q=...
```

Proxies the official Jorudan station suggest API, returning the closest match to the query `q`.

## License

Distributed under the [LICENSE](LICENSE.md).
Feel free to open an issue or pull request if you have any questions, requests, or want to contribute.