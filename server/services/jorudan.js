const axios   = require('axios');
const cheerio = require('cheerio');

const mapping = {
  departOrArrive: { departure: 0, arrival: 1, first: 2, last: 3 },
  paymentType:    { ic: 1, ticket: 2 },
  discountType:   {
    none: 0, zipangu: 2, zipangu_first: 1,
    otona_zipangu: 3, otona_middle: 4, otona_west: 5, shikoku_zipangu: 6
  },
  commuteType:    {
    commute: 1, offpeak_commute: 5, university: 2,
    highschool: 3, junior: 4
  },
  airplaneUse:    { allow: 0, forbid: 1 },
  busUse:         { allow: 0, forbid: 1 },
  expressTrainUse:{ allow: 0, prefer: 3, avoid: 4, forbid: 1 },
  seatPreference: { any: 5, reserved: 0, free: 1, green: 2 },
  preferredTrain: { nozomi: 0, hikari: 1, local: 2 },
  transferTime:   { short: 1, normal: 2, relaxed: 3 },
  sort:           { recommend: 'rec', arrival: 'time', duration: 'fast', transfer: 'change', price: 'cheap' }
};

const mapParam = (key, value) =>
  mapping[key] && mapping[key][value] !== undefined ? mapping[key][value] : value;

async function suggestName(raw) {
  try {
    const url = `https://navi.jorudan.co.jp/api/compat/suggest/agg?lang=ja&limit=1&q=${encodeURIComponent(raw)}`;
    const { data } = await axios.get(url);
    if (data?.R?.length) return data.R[0].poiName;
  } catch (err) {
    console.warn('[SUGGEST]', raw, '→', err.message);
  }
  return raw;
}

async function scrapeJorudan(params) {
  let { from, to, year, month, day, hour, minute } = params;
  from = await suggestName(from);
  to   = await suggestName(to);

  const minuteStr = minute.toString().padStart(2, '0');
  const url = 'https://www.jorudan.co.jp/norikae/cgi/nori.cgi'
    + `?eki1=${encodeURIComponent(from)}`
    + `&eki2=${encodeURIComponent(to)}`
    + `&via_on=-1`
    + `&Dyy=${year}&Dmm=${month}&Ddd=${day}`
    + `&Dhh=${hour}&Dmn1=${minuteStr[0]}&Dmn2=${minuteStr[1]}`
    + `&Cway=${mapParam('departOrArrive',  params.departOrArrive || 'departure')}`
    + `&Cfp=${mapParam('paymentType',      params.paymentType   || 'ic')}`
    + `&Czu=${mapParam('discountType',     params.discountType  || 'none')}`
    + `&C7=${mapParam('commuteType',       params.commuteType   || 'commute')}`
    + `&C2=${mapParam('airplaneUse',       params.airplaneUse   || 'forbid')}`
    + `&C3=${mapParam('busUse',            params.busUse        || 'forbid')}`
    + `&C1=${mapParam('expressTrainUse',   params.expressTrainUse||'allow')}`
    + `&cartaxy=${params.allowCarTaxi==='false'?0:1}`
    + `&bikeshare=${params.allowBike==='false'?0:1}`
    + `&sort=${mapParam('sort',            params.sort          || 'recommend')}`
    + `&C4=${mapParam('seatPreference',    params.seatPreference|| 'any')}`
    + `&C5=${mapParam('preferredTrain',    params.preferredTrain|| 'nozomi')}`
    + `&C6=${mapParam('transferTime',      params.transferTime  || 'normal')}`
    + `&S=%E6%A4%9C%E7%B4%A2`
    + `&Csg=${params.searchType || 1}`;

  console.log('[JORUDAN] Fetching:', url);
  const { data: html } = await axios.get(url);
  const $ = cheerio.load(html);

  const results = [];

  $('.bk_result').each((_, elem) => {
    const block = $(elem);

    // --- date / times ---
    let dateText = '';
    const rawDay = block.find('.data_line_1 .data_day');
    if (rawDay.length) {
      rawDay.children('div').remove();
      const txt = rawDay.text().trim();
      const m   = txt.match(/(\d{4}\/\d{2}\/\d{2})/);
      dateText = m?.[1] || '';
    }
    if (!dateText) {
      const ymd = block.find('.data_line_1 .data_tm b.ymd');
      if (ymd.length >= 2) {
        dateText = `${ymd.first().text().trim()} → ${ymd.last().text().trim()}`;
      }
    }
    const timeBs        = block.find('.data_line_1 .data_tm b').not('.ymd');
    const departureTime = timeBs.first().text().trim();
    const arrivalTime   = timeBs.last().text().trim();

    // --- summary ---
    const price        = block.find('.data_line_1 .data_total dd b').text().trim();
    const duration     = block.find('.data_total-time dd b').text().trim();
    const transfers    = block.find('.data_norikae-num dd b').text().trim();
    const co2Emission  = block.find('.data_norikae-eco dd b').first().text().trim();
    const co2Reduction = block.find('.data_norikae-eco dd b').eq(1).text().trim();

    // --- stations list ---
    const stations = [];
    block.find('.route table tr.eki').each((__, row) => {
      const $r   = $(row);
      const name = $r.find('td.nm a').text().trim();
      if (!name) return;
      stations.push({
        stationName: name,
        timeLink:    $r.find('a.time').attr('href') || ''
      });
    });

    // --- ride segments ---
    const segments = [];
    block.find('.route table tr.rosen').each((__, row) => {
      const $r   = $(row);
      // times + duration
      const textTm = $r.find('td.tm').text().trim();
      const parts  = textTm.split('\n').map(s => s.trim()).filter(Boolean);
      const [depArr='', legDur=''] = parts;
      const [depSeg='', arrSeg=''] = depArr.split('-').map(s=>s.trim());

      // color + stripe
      const $stripe = $r.find('td.ln .line_border_stripe');
      const $border = $stripe.length
        ? $stripe
        : $r.find('td.ln .line_border');
      const style      = $border.attr('style') || '';
      const colorMatch = style.match(/background-color:([^;]+);/);
      const color      = colorMatch?.[1] || '';
      const striped    = $stripe.length > 0;

      // train name + stoplist link
      const $link     = $r.find('td.rn div a');
      const trainName = $link.text().trim().replace(/\n/g,' ');
      const timeLink  = $link.attr('href') || '';

      // fare / distance
      const fare     = $r.find('td.fr').text().trim();
      const distance = $r.find('td.km').text().trim();

      // ** train type **
      const altImg   = $r.find('td.gf img').attr('alt');
      const trainType= altImg || '普通';

      segments.push({
        departure: depSeg,
        arrival:   arrSeg,
        duration:  legDur,
        line:      trainName,
        color,
        striped,
        timeLink,
        fare,
        distance,
        trainType
      });
    });

    // --- transfer details ---
    const changes = [];
    block.find('.route table tr.eki').each((__, row) => {
      const $r = $(row);
      if ($r.hasClass('eki_s') || $r.hasClass('eki_e')) return;

      const htmlTm = $r.find('td.tm').html() || '';
      const parts  = htmlTm.split('<br>').map(s=>s.replace(/<[^>]+>/g,'').trim());

      // on ne fait .match QUE si la partie existe
      let transferTime = '', waitTime = '';
      if (parts[0]) {
        const m = parts[0].match(/乗換(\d+分)/);
        transferTime = m?.[1] || '';
      }
      if (parts[1]) {
        const m = parts[1].match(/待ち(\d+分)/);
        waitTime = m?.[1] || '';
      }

      changes.push({
        stationName:       $r.find('td.nm a').text().trim(),
        transferTime,
        waitTime,
        arrivalPlatform:   $r.find('td.ph div').first().text().trim(),
        departurePlatform: $r.find('td.ph div').eq(1).text().trim()
      });
    });

    results.push({
      route:        block.find('.header .js_sortNum').text().trim(),
      date:         dateText,
      departureTime,
      arrivalTime,
      price,
      duration,
      transfers,
      co2:          { emission: co2Emission, reduction: co2Reduction },
      stations,
      segments,
      changes
    });
  });

  return results;
}

module.exports = scrapeJorudan;
