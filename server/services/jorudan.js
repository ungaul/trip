const axios = require('axios');
const cheerio = require('cheerio');

const mapping = {
  departOrArrive: { departure: 0, arrival: 1, first: 2, last: 3 },
  paymentType: { ic: 1, ticket: 2 },
  discountType: {
    none: 0, zipangu: 2, zipangu_first: 1,
    otona_zipangu: 3, otona_middle: 4, otona_west: 5, shikoku_zipangu: 6
  },
  commuteType: {
    commute: 1, offpeak_commute: 5, university: 2,
    highschool: 3, junior: 4
  },
  airplaneUse: { allow: 0, forbid: 1 },
  busUse: { allow: 0, forbid: 1 },
  expressTrainUse: { allow: 0, prefer: 3, avoid: 4, forbid: 1 },
  seatPreference: { any: 5, reserved: 0, free: 1, green: 2 },
  preferredTrain: { nozomi: 0, hikari: 1, local: 2 },
  transferTime: { short: 1, normal: 2, relaxed: 3 },
  sort: { recommend: 'rec', arrival: 'time', duration: 'fast', transfer: 'change', price: 'cheap' }
};

const mapParam = (key, value) =>
  mapping[key] && mapping[key][value] !== undefined ? mapping[key][value] : value;

async function scrapeJorudan(params) {
  const { from, to, year, month, hour, minute } = params;
  const minuteStr = minute.toString().padStart(2, '0');

  const url = `https://www.jorudan.co.jp/norikae/cgi/nori.cgi` +
    `?eki1=${encodeURIComponent(from)}` +
    `&eki2=${encodeURIComponent(to)}` +
    `&via_on=-1` +
    `&Dyy=${year}` +
    `&Dmm=${month}` +
    // on supprime &Ddd, on ne l’envoie plus
    `&Dhh=${hour}` +
    `&Dmn1=${minuteStr[0]}` +
    `&Dmn2=${minuteStr[1]}` +
    `&Cway=${mapParam('departOrArrive', params.departOrArrive || 'departure')}` +
    `&Cfp=${mapParam('paymentType', params.paymentType || 'ic')}` +
    `&Czu=${mapParam('discountType', params.discountType || 'none')}` +
    `&C7=${mapParam('commuteType', params.commuteType || 'commute')}` +
    `&C2=${mapParam('airplaneUse', params.airplaneUse || 'forbid')}` +
    `&C3=${mapParam('busUse', params.busUse || 'forbid')}` +
    `&C1=${mapParam('expressTrainUse', params.expressTrainUse || 'allow')}` +
    `&cartaxy=${params.allowCarTaxi === 'false' ? 0 : 1}` +
    `&bikeshare=${params.allowBike === 'false' ? 0 : 1}` +
    `&sort=${mapParam('sort', params.sort || 'recommend')}` +
    `&C4=${mapParam('seatPreference', params.seatPreference || 'any')}` +
    `&C5=${mapParam('preferredTrain', params.preferredTrain || 'nozomi')}` +
    `&C6=${mapParam('transferTime', params.transferTime || 'normal')}` +
    `&S=%E6%A4%9C%E7%B4%A2` +
    `&Csg=${params.searchType || 1}`;

  console.log(`[JORUDAN] Fetching: ${url}`);
  const { data } = await axios.get(url);
  const $ = cheerio.load(data);
  const results = [];

  $('.bk_result').each((i, elem) => {
    const block = $(elem);

    // 1) Numéro de l’itinéraire
    const routeNum = block.find('.header .js_sortNum').text().trim();

    // 2) Date
    let dateText = '';
    let dayText  = '';

    // a) même journée
    const rawDay = block.find('.data_line_1 .data_day');
    if (rawDay.length) {
      rawDay.children('div').remove();
      const txt = rawDay.text().trim();
      const m   = txt.match(/(\d{4}\/\d{2}\/\d{2})/);
      dateText = m ? m[1] : '';
      dayText  = rawDay.find('.com_holiday').text().trim();
    }

    // b) multi‐jours
    if (!dateText) {
      const ymd = block.find('.data_line_1 .data_tm b.ymd');
      if (ymd.length >= 2) {
        dateText = `${ymd.first().text().trim()} → ${ymd.last().text().trim()}`;
      }
    }

    // 3) Heures de départ / arrivée
    const timeBs = block.find('.data_line_1 .data_tm b').not('.ymd');
    const departureTime = timeBs.first().text().trim();
    const arrivalTime   = timeBs.last().text().trim();

    // 4) Tarif, durée, transferts, CO₂
    const price       = block.find('.data_line_1 .data_total dd b').text().trim();
    const duration    = block.find('.data_total-time dd b').text().trim();
    const transfers   = block.find('.data_norikae-num dd b').text().trim();
    const co2Emission = block.find('.data_norikae-eco dd b').first().text().trim();
    const co2Reduction= block.find('.data_norikae-eco dd b').eq(1).text().trim();

    // 5) Stations et noms de trains
    const stations = [], trains = [];
    block.find('.route table tr').each((j, row) => {
      const $r = $(row);
      if ($r.hasClass('eki')) {
        stations.push({ stationName: $r.find('td.nm a').text().trim() });
      }
      if ($r.hasClass('rosen')) {
        trains.push({ trainName: $r.find('td.rn a').text().trim().replace(/\n/g, ' ') });
      }
    });

    // 6) Segments détaillés
    const segments = [];
    block.find('.route table tr.rosen').each((j, row) => {
      const $r     = $(row);
      const parts  = $r.find('td.tm').text().trim()
        .split('\n').map(s => s.trim()).filter(Boolean);
      const [depArr = '', legDur = ''] = parts;
      const [depSeg = '', arrSeg = ''] = depArr.split('-').map(s => s.trim());

      segments.push({
        departure: depSeg,
        arrival:   arrSeg,
        duration:  legDur,
        line:      $r.find('td.rn div a').text().trim(),
        fare:      $r.find('td.fr').text().trim(),
        distance:  $r.find('td.km').text().trim()
      });
    });

    results.push({
      route:         routeNum,
      date:          dateText,
      day:           dayText,
      departureTime,
      arrivalTime,
      price,
      duration,
      transfers,
      co2: { emission: co2Emission, reduction: co2Reduction },
      stations,
      trains,
      segments
    });
  });

  return results;
}

module.exports = scrapeJorudan;
