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
  const { from, to, year, month, day, hour, minute } = params;
  const minuteStr = minute.toString().padStart(2, '0');

  const url = `https://www.jorudan.co.jp/norikae/cgi/nori.cgi?eki1=${encodeURIComponent(from)}&eki2=${encodeURIComponent(to)}&via_on=-1&Dyy=${year}&Dmm=${month}&Ddd=${day}&Dhh=${hour}&Dmn1=${minuteStr[0]}&Dmn2=${minuteStr[1]}&Cway=${mapParam('departOrArrive', params.departOrArrive || 'departure')}&Cfp=${mapParam('paymentType', params.paymentType || 'ic')}&Czu=${mapParam('discountType', params.discountType || 'none')}&C7=${mapParam('commuteType', params.commuteType || 'commute')}&C2=${mapParam('airplaneUse', params.airplaneUse || 'allow')}&C3=${mapParam('busUse', params.busUse || 'forbid')}&C1=${mapParam('expressTrainUse', params.expressTrainUse || 'allow')}&cartaxy=${params.allowCarTaxi === 'false' ? 0 : 1}&bikeshare=${params.allowBike === 'false' ? 0 : 1}&sort=${mapParam('sort', params.sort || 'recommend')}&C4=${mapParam('seatPreference', params.seatPreference || 'any')}&C5=${mapParam('preferredTrain', params.preferredTrain || 'nozomi')}&C6=${mapParam('transferTime', params.transferTime || 'normal')}&S=%E6%A4%9C%E7%B4%A2&Csg=${params.searchType || 1}`.replace(/\n/g, '');

  console.log(`[JORUDAN] Fetching: ${url}`);
  const { data } = await axios.get(url);
  const $ = cheerio.load(data);

  const results = [];

  $('.bk_result').each((i, elem) => {
    const block = $(elem);
    const stations = [];
    const trains = [];

    block.find('.route table tr').each((j, row) => {
      const $row = $(row);
      if ($row.hasClass('eki')) {
        const stationName = $row.find('.nm a').text().trim();
        stations.push({ stationName });
      } else if ($row.hasClass('rosen')) {
        const trainName = $row.find('.rn a').text().trim().replace(/\n/g, ' ');
        trains.push({ trainName });
      }
    });

    results.push({ stations, trains });
  });

  return results;
}

module.exports = scrapeJorudan;
