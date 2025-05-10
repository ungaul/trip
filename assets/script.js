$(document).ready(function () {
  function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371, toRad = d => d * Math.PI / 180;
    const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function toLocalInput(dt) {
    const pad = v => String(v).padStart(2, '0');
    return dt.getFullYear() + '-'
      + pad(dt.getMonth() + 1) + '-'
      + pad(dt.getDate()) + 'T'
      + pad(dt.getHours()) + ':'
      + pad(dt.getMinutes());
  }

  async function findNearestStation(lat, lon) {
    const q = `[out:json];node(around:5000,${lat},${lon})[railway=station];out;`;
    const url = 'https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(q);
    try {
      const resp = await fetch(url), json = await resp.json();
      let best = null, minD = Infinity;
      json.elements.forEach(n => {
        const d = haversine(lat, lon, n.lat, n.lon);
        if (d < minD) { minD = d; best = n; }
      });
      return best ? (best.tags['name:ja'] || best.tags.name) : null;
    } catch {
      return null;
    }
  }

  function formatDateWithoutYear(s) {
    const parts = s.split(' ')[0].split('/');
    if (parts.length !== 3) return s;
    return parts[1].padStart(2, '0') + '/' + parts[2].padStart(2, '0');
  }

  function createItemContainer(label, value = '') {
    return `
      <div class="item-container">
        <div class="item-contents">
          <div class="item"><span>${label}:</span>
            <input type="text" name="Location" value="${value}" placeholder="…">
          </div>
        </div>
      </div>
    `;
  }

  const params = new URLSearchParams(window.location.search);
  function prefill() {
    const from = params.get('from') || '',
      bys = params.getAll('by'),
      to = params.get('to') || '';
    $('#items').empty();
    $('#items').append(createItemContainer('From', from));
    bys.forEach(b => $('#items').append(createItemContainer('By', b)));
    $('#items').append(createItemContainer('To', to));

    // build departure val from either ?departure=… or year/month/day/hour/min
    let depVal = params.get('departure');
    if (!depVal && params.has('year') && params.has('hour')) {
      depVal =
        `${params.get('year').padStart(4, '0')}-${params.get('month').padStart(2, '0')}-${params.get('day').padStart(2, '0')}` +
        `T${params.get('hour').padStart(2, '0')}:${params.get('minute').padStart(2, '0')}`;
    }
    $('input[name="Departure"]').val(depVal || toLocalInput(new Date()));

    if (params.has('return')) {
      $('input[name="Return"]').val(params.get('return'));
    }

    // ** NEW **: read every setting from the URL and mark it selected
    [
      'departOrArrive', 'paymentType', 'discountType', 'commuteType',
      'airplaneUse', 'busUse', 'expressTrainUse',
      'allowCarTaxi', 'allowBike',
      'sort', 'seatPreference', 'preferredTrain',
      'transferTime', 'searchType'
    ].forEach(key => {
      const val = params.get(key);
      if (val) {
        const $sel = $(`#${key}`);
        $sel.attr('data-current', val);
        $sel.find(`div[value="${val}"]`).addClass('selected');
      }
    });

    if ($('#items .item-container').length > 2) {
      $('#app').addClass('vertical');
    }
  }
  prefill();

  const maxStops = 4;
  function refreshMoreIcons() {
    $('#items .item-container').each(function (i) {
      const $ct = $(this);
      $ct.find('.more').remove();
      if (i < $('#items .item-container').length - 1) {
        $ct.find('.item-contents').append('<div class="more"><ion-icon name="add-outline"></ion-icon></div>');
      }
    });
  }
  function refreshCloses() {
    const len = $('#items .item-container').length;
    $('#items .item-container').each(function (i) {
      const $ct = $(this);
      $ct.find('.close').remove();
      if (i > 0 && i < len - 1) {
        $ct.find('.item-contents').append('<ion-icon class="close" name="close-outline"></ion-icon>');
      }
    });
  }
  refreshMoreIcons();
  refreshCloses();

  $('#items')
    .on('click', '.more', function (e) {
      e.preventDefault();
      if ($('#items .item-container').length >= maxStops + 2) return;
      $('#app').addClass('vertical');
      const $p = $(this).closest('.item-container');
      $p.after(createItemContainer('By'));
      refreshMoreIcons();
      refreshCloses();
    })
    .on('click', '.close', function (e) {
      e.stopPropagation();
      $(this).closest('.item-container').remove();
      refreshMoreIcons();
      refreshCloses();
    })
    .on('input', 'input[name="Location"]', function () {
      const $ct = $(this).closest('.item-container'),
        idx = $('#items .item-container').index($ct),
        tot = $('#items .item-container').length;
      if (idx > 0 && idx < tot - 1 && !$ct.find('.stay-duration').length) {
        $ct.append(`
          <div class="stay-duration">
            <div class="destination-setting">
              <div value="3">3h</div>
              <div value="6" class="selected">6h</div>
              <div value="12">12h</div>
              <div value="24">24h</div>
            </div>
          </div>
        `);
      }
    })
    .on('click', '.destination-setting div', function () {
      const $opt = $(this),
        $grp = $opt.closest('.destination-setting');
      $grp.find('div').removeClass('selected');
      $opt.addClass('selected');
    });

  function renderTrips(data, $ct) {
    let arr = [];
    if (Array.isArray(data.results)) {
      arr = data.results;
    } else if (data.results && Array.isArray(data.results.results)) {
      arr = data.results.results;
    }
    if (!arr.length) {
      $ct.append('<div class="error">データが無効です</div>');
      return;
    }

    const firstTrip = arr[0];

    function makeStop(name) {
      return $('<div>').addClass('stop')
        .append($('<span>').addClass('stop-dot'))
        .append($('<div>').addClass('stop-label').text(name));
    }

    arr.slice(0, 1).forEach((trip, idx) => {
      const sd = trip.date || ''; // Get the full date range (e.g., "05/10 → 05/11")
      let departureDate = '', arrivalDate = '';

      if (sd) {
        // If there's a day change (e.g., "05/10 → 05/11"), split the date into departure and arrival
        [departureDate, arrivalDate] = sd.split(' → ');
      }

      const departureTime = trip.departureTime || ''; // Departure time (e.g., "22:41")
      const arrivalTime = trip.arrivalTime || ''; // Arrival time (e.g., "00:29")

      let formattedDeparture = departureTime;
      let formattedArrival = arrivalTime;

      if (departureDate && arrivalDate) {
        // If it's a day change, add the date to the departure and arrival times
        formattedDeparture = departureDate + ' ' + departureTime;
        formattedArrival = arrivalDate + ' ' + arrivalTime;
      }

      const $trip = $('<div>').addClass('trip'),
        $top = $('<div>').addClass('trip-data top'),
        $l = $('<div>').addClass('left-info'),
        $r = $('<div>').addClass('right-info'),
        $info = $('<div>').addClass('info')
          .append(
            $('<div>').addClass('departure')
              .append($('<div>').addClass('date').text(formattedDeparture)) // Departure: Date + Time
              .append($('<div>').addClass('place').text(trip.stations[0]?.stationName || ''))
          )
          .append(
            $('<div>').addClass('arrival')
              .append($('<div>').addClass('date').text(formattedArrival)) // Arrival: Date + Time
              .append($('<div>').addClass('place').text(trip.stations.slice(-1)[0]?.stationName || ''))
          );

      const $meta = $('<div>').addClass('bottom')
        .append($('<div>').addClass('duration').html(`<span>時間</span>${trip.duration}`))
        .append($('<div>').addClass('transfers').html(`<span>乗換</span>${trip.transfers}`))
        .append($('<div>').addClass('emission').html(`<span>CO₂</span>${trip.co2.emission}`))
        .append($('<div>').addClass('co2-red').html(`<span>自動車比</span>${trip.co2.reduction}`))
        .append($('<div>').addClass('price').html(`<span>総額</span>${trip.price}`));
      $l.append($info, $meta);
      $r.html('<div class="moreInfo"><ion-icon name="chevron-down-outline"></ion-icon></div>');
      $top.append($l, $r);
      $trip.append($top);

      const $timeline = $('<div>').addClass('timeline')
        .append(makeStop(trip.stations[0]?.stationName || ''));
      trip.segments.forEach((seg, i) => {
        const $seg = $('<div>').addClass('segment'),
          $sgt = $('<div>').addClass('segTiming'),
          $ln = $('<div>').addClass('seg-line');
        $sgt.append($('<div>').addClass('seg-time').text(`${seg.departure} → ${seg.arrival}`))
          .append($('<div>').addClass('seg-duration').text(seg.duration));
        if (seg.color) {
          const $col = $('<span>').addClass('line-color')
            .css({ backgroundColor: seg.color, borderColor: seg.color });
          if (seg.striped) $col.addClass('stripe');
          $ln.append($col);
        }
        $ln.append(seg.timeLink ? $('<p>').text(seg.line) : $('<span>').text(seg.line));
        $seg.append($sgt, $ln)
          .append($('<div>').addClass('seg-distance').text(seg.distance))
          .append($('<div>').addClass('seg-fare').text(seg.fare));
        $timeline.append($seg)
          .append(makeStop(trip.stations[i + 1]?.stationName || ''));
      });

      $ct.append($trip.append($timeline));
    });

    $ct.find('.trip').first()
      .addClass('active')
      .find('.moreInfo').addClass('active');
  }

  async function triggerSearch(updateURL = true) {
    console.log('triggerSearch called');
    const raw = $('#items .item input[name="Location"]').map((i, el) => $(el).val().trim()).get();
    console.log('Raw stops =', raw);
    if (raw.length < 2) {
      $('#notification').addClass('active').html(`
        <ion-icon name="alert-circle-outline"></ion-icon>
        <p>出発地と到着地を2つ以上入力してください。</p>`);
      return;
    }
    $('#notification').empty();

    const depVal = $('input[name="Departure"]').val(),
      retVal = $('input[name="Return"]').val();

    const filters = {};
    [
      'departOrArrive', 'paymentType', 'discountType', 'commuteType',
      'airplaneUse', 'busUse', 'expressTrainUse',
      'allowCarTaxi', 'allowBike',
      'sort', 'seatPreference', 'preferredTrain',
      'transferTime', 'searchType'
    ].forEach(k => filters[k] = $(`#${k}`).attr('data-current') || '');

    const newP = new URLSearchParams();
    newP.set('from', raw[0]);
    raw.slice(1, -1).forEach(b => newP.append('by', b));
    newP.set('to', raw[raw.length - 1]);
    newP.set('departure', depVal);
    if (retVal) newP.set('return', retVal);
    Object.entries(filters).forEach(([k, v]) => newP.set(k, v));

    if (updateURL) {
      console.log('Updating URL:', newP.toString());
      window.history.replaceState(null, '', '?' + newP.toString());
    }

    $('#trips').empty().append(`
      <div id="loader" class="active">
        <div class="lds-spinner">${'<div></div>'.repeat(12)}</div>
      </div>
    `);

    let currentDeparture = new Date(depVal);
    async function fetchLeg(from, to, idx, stayH = 0) {
      const depStr = toLocalInput(currentDeparture);
      const [YMD, HMS] = depStr.split('T'),
        [year2, month2, day2] = YMD.split('-'),
        [hour2, minute2] = HMS.split(':');
      const paramsLeg = {
        from, to,
        year: year2, month: month2, day: day2,
        hour: hour2, minute: minute2,
        ...filters
      };
      const url = 'http://localhost:3000/scrape?' + $.param(paramsLeg);
      console.log(`[fetchLeg ${idx}] ${from} → ${to} @ ${depStr}`);
      const $grp = $('<div>').addClass('leg'),
        $list = $('<div>').addClass('trip-list');
      $('#loader').before($grp.append($list));
      try {
        const data = await $.getJSON(url);
        console.log(`[fetchLeg ${idx}] data received`);
        renderTrips(data, $list);
        const first = Array.isArray(data.results)
          ? data.results[0]
          : data.results.results[0];
        const [arrH, arrM] = first.arrivalTime.split(':').map(Number);
        currentDeparture.setHours(arrH);
        currentDeparture.setMinutes(arrM + stayH * 60);
        console.log(`Next departure = ${toLocalInput(currentDeparture)}`);
      } catch (err) {
        console.error(`[fetchLeg ${idx}]`, err);
        $list.append($('<div>').addClass('error').text('Erreur chargement'));
      }
    }

    for (let i = 0; i < raw.length - 1; i++) {
      const $ct = $('#items .item-container').eq(i + 1),
        stayH = parseInt($ct.find('.destination-setting .selected').attr('value'), 10) || 0;
      await fetchLeg(raw[i], raw[i + 1], i, i < raw.length - 2 ? stayH : 0);
    }

    if (retVal || raw.length > 1) {
      console.log('Return trip starting at', toLocalInput(currentDeparture));
      await fetchLeg(raw[raw.length - 1], raw[0], raw.length - 1);
    }

    console.log('All legs done');
    $('#loader').removeClass('active');
  }

  $('#submit').click(e => { e.preventDefault(); triggerSearch(); });
  $('#formContainer').on('keydown', 'input,select', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      triggerSearch();
    }
  });
  $('#notification').click(() => $('#notification').removeClass('active'));

  $('.select').off('click').on('click', 'div[value]', function (e) {
    e.stopPropagation();
    const $t = $(this), v = $t.attr('value'),
      $sel = $t.closest('.select');
    $sel.attr('data-current', v)
      .children().removeClass('selected');
    $t.addClass('selected');
    triggerSearch();
  });

  $('#calendar').html('<input id="fpInline" type="text"/>').hide();
  flatpickr('#fpInline', {
    inline: true,
    mode: 'range',
    enableTime: true,
    dateFormat: 'Y-m-d\\TH:i',
    onChange(sel, _, inst) {
      if (sel.length === 1) {
        $('input[name="Departure"]').val(inst.formatDate(sel[0], 'Y-m-d\\TH:i'));
        $('input[name="Return"]').val('');
      } else {
        $('input[name="Departure"]').val(inst.formatDate(sel[0], 'Y-m-d\\TH:i'));
        $('input[name="Return"]').val(inst.formatDate(sel[1], 'Y-m-d\\TH:i'));
        triggerSearch();
        $('#calendar').hide();
      }
    }
  });

  const $fromField = $('#from');
  if ($fromField.length && !$fromField.val()) {
    navigator.geolocation.getCurrentPosition(async pos => {
      const name = await findNearestStation(pos.coords.latitude, pos.coords.longitude);
      if (name) $fromField.val(name);
    });
  }

  if (params.has('from') && (params.has('to') || params.has('by'))) {
    triggerSearch(false);
  }
});
