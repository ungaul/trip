$(document).ready(function () {
  function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371, toRad = d => d * Math.PI / 180;
    const dLat = toRad(lat2 - lat1), dLon = toRad(lat2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  function toLocalInput(dt) {
    const pad = v => String(v).padStart(2, '0');
    return dt.getFullYear() + '-' +
      pad(dt.getMonth() + 1) + '-' +
      pad(dt.getDate()) + 'T' +
      pad(dt.getHours()) + ':' +
      pad(dt.getMinutes());
  }
  async function findNearestStation(lat, lon) {
    const q = `[out:json];node(around:5000,${lat},${lon})[railway=station];out;`;
    const url = 'https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(q);
    try {
      const resp = await fetch(url);
      const json = await resp.json();
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
    const from = params.get('from') || '';
    const bys = params.getAll('by');
    const byTimes = params.getAll('byTime');
    const to = params.get('to') || '';

    $('#items').empty();

    $('#items').append(createItemContainer('From', from));

    bys.forEach((b, index) => {
      const byItem = $(createItemContainer('By', b));
      $('#items').append(byItem);
      const byTime = byTimes[index] || '6';
      byItem.append(`
      <div class="stay-duration">
        <div class="destination-setting">
          <div value="3" ${byTime === '3' ? 'class="selected"' : ''}>3h</div>
          <div value="6" ${byTime === '6' ? 'class="selected"' : ''}>6h</div>
          <div value="12" ${byTime === '12' ? 'class="selected"' : ''}>12h</div>
          <div value="24" ${byTime === '24' ? 'class="selected"' : ''}>24h</div>
        </div>
      </div>
    `);
    });

    if (bys.length === 0) {
      const emptyBy = $(createItemContainer('By'));
      $('#items').append(emptyBy);
      emptyBy.find('.close').remove();
    }
    const toItem = $(createItemContainer('To', to));
    $('#items').append(toItem);

    if (!to) {
      navigator.geolocation.getCurrentPosition(async pos => {
        const name = await findNearestStation(pos.coords.latitude, pos.coords.longitude);
        if (name) {
          $('#items .item-container').last().find('input[name="Location"]').val(name);
        }
      });
    }

    let depVal = params.get('departure');
    if (depVal && depVal.includes('_')) {
      const parts = depVal.split('_');
      if (parts.length === 2) {
        depVal = parts[0] + 'T' + parts[1].replace('-', ':');
      }
    }

    if (!depVal && params.has('year') && params.has('hour')) {
      depVal =
        `${params.get('year').padStart(4, '0')}-${params.get('month').padStart(2, '0')}-${params.get('day').padStart(2, '0')}` +
        `T${params.get('hour').padStart(2, '0')}:${params.get('minute').padStart(2, '0')}`;
    }

    $('input[name="Departure"]').val(depVal || toLocalInput(new Date()));

    if (params.has('return')) {
      let retVal = params.get('return');
      if (retVal && retVal.includes('_') && retVal.includes('-')) {
        retVal = retVal.replace('_', 'T').replace('-', ':');
      }
      $('input[name="Return"]').val(retVal);
    }

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

    const inputs = $('#items .item input[name="Location"]');
    const required = [inputs.eq(0), inputs.eq(1), inputs.eq(inputs.length - 1)];
    const missing = required.some($el => !$el.val().trim());
    if (params.has('from') && (params.has('to') || params.has('by'))) {
      setTimeout(() => triggerSearch(false), 100);
    }
  }

  prefill();
  const maxStops = 4;
  function refreshMoreIcons() {
    $('#items .item-container').each(function (i) {
      const $ct = $(this);
      $ct.find('.more').remove();
      if (i < $('#items .item-container').length - 1) {
        $ct.append('<div class="more"><ion-icon name="add-outline"></ion-icon></div>');
      }
    });
  }
  function refreshCloses() {
    const $items = $('#items .item-container');
    const count = $items.length;

    $items.each(function (i) {
      const $ct = $(this);
      $ct.find('.close').remove();

      const isBy = i > 0 && i < count - 1;
      const isFirstBy = i === 1;
      if (isBy && !isFirstBy) {
        $ct.find('.item-contents').append('<ion-icon class="close" name="close-outline"></ion-icon>');
      }
    });
  }
  refreshMoreIcons();
  refreshCloses();
  $('#items .item-container').first().find('input[name="Location"]').attr('id', 'from');
  $('#items .item-container').last().find('input[name="Location"]').attr('id', 'to');
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
    function makeStop(name, transferTimeString, waitTimeString, arrivalPlatform, departurePlatform) {
      const $stop = $('<div>').addClass('stop');
      const $stopChange = $('<div>').addClass('stop-change');
      let hasChangeInfo = false;

      function parseTimeValue(timeStringWithUnit) {
        if (typeof timeStringWithUnit === 'string' && timeStringWithUnit.includes('分')) {
          const parsed = parseInt(timeStringWithUnit, 10);
          return isNaN(parsed) ? null : parsed;
        }
        if (typeof timeStringWithUnit === 'number' && !isNaN(timeStringWithUnit)) {
          return timeStringWithUnit;
        }
        return null;
      }

      const numericTransferTime = parseTimeValue(transferTimeString);
      const numericWaitTime = parseTimeValue(waitTimeString);

      if (typeof numericTransferTime === 'number') {
        $stopChange.append($('<div>').addClass('transfer-time').text(`乗換時間: ${numericTransferTime}分`));
        hasChangeInfo = true;
      }

      if (typeof numericWaitTime === 'number') {
        $stopChange.append($('<div>').addClass('waiting-time').text(`待機時間: ${numericWaitTime}分`));
        hasChangeInfo = true;
      }

      if (hasChangeInfo) {
        $stop.append($stopChange);
      }

      $stop.append($('<span>').addClass('stop-dot'));

      const $stopLabel = $('<div>').addClass('stop-label').text(name || '');
      $stop.append($stopLabel);

      if (arrivalPlatform || departurePlatform) {
        const $platforms = $('<div>').addClass('platforms');

        if (arrivalPlatform) {
          $platforms.append($('<span>').addClass('arrival-platform').text(`着 ${arrivalPlatform}`));
        }

        if (departurePlatform) {
          $platforms.append($('<span>').addClass('departure-platform').text(`発 ${departurePlatform}`));
        }

        $stop.append($platforms);
      }

      return $stop;
    }

    arr.slice(0, 1).forEach(trip => {
      const sd = trip.date || '';
      let departureDate = '', arrivalDate = '';
      if (sd) {
        [departureDate, arrivalDate] = sd.split(' → ');
      }
      const departureTime = trip.departureTime || '';
      const arrivalTime = trip.arrivalTime || '';
      let formattedDeparture = departureTime;
      let formattedArrival = arrivalTime;
      if (departureDate && arrivalDate) {
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
              .append($('<div>').addClass('date').text(formattedDeparture))
              .append($('<div>').addClass('place').text(trip.stations[0]?.stationName || ''))
          )
          .append(
            $('<div>').addClass('arrival')
              .append($('<div>').addClass('date').text(formattedArrival))
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
      const $timeline = $('<div>').addClass('timeline');
      const changesLookup = {};
      if (trip.changes && Array.isArray(trip.changes)) {
        trip.changes.forEach(change => {
          changesLookup[change.stationName] = change;
        });
      }
      trip.stations.forEach((stationObj, i) => {
        const stationName = stationObj?.stationName || (typeof stationObj === 'string' ? stationObj : '');
        let transferTimeStr = null;
        let waitTimeStr = null;
        let arrivalPlatform = null;
        let departurePlatform = null;

        const changeDataForStation = changesLookup[stationName];
        if (changeDataForStation) {
          transferTimeStr = changeDataForStation.transferTime;
          waitTimeStr = changeDataForStation.waitTime;
          arrivalPlatform = changeDataForStation.arrivalPlatform;
          departurePlatform = changeDataForStation.departurePlatform;
        }

        $timeline.append(makeStop(stationName, transferTimeStr, waitTimeStr, arrivalPlatform, departurePlatform));
        if (i < trip.segments.length) {
          const currentSegmentData = trip.segments[i];
          const $segmentDiv = $('<div>').addClass('segment');
          const $sgt = $('<div>').addClass('segTiming');
          const $ln = $('<div>').addClass('seg-line');
          $sgt.append($('<div>').addClass('seg-time').text(`${currentSegmentData.departure} → ${currentSegmentData.arrival}`))
            .append($('<div>').addClass('seg-duration').text(currentSegmentData.duration));

          if (currentSegmentData.color) {
            const $col = $('<span>').addClass('line-color')
              .css({ backgroundColor: currentSegmentData.color, borderColor: currentSegmentData.color });
            if (currentSegmentData.striped) $col.addClass('stripe');
            $ln.append($col);
          }
          $ln.append(currentSegmentData.timeLink ? $('<p>').text(currentSegmentData.line) : $('<span>').text(currentSegmentData.line));
          $segmentDiv.append($sgt, $ln)
            .append($('<div>').addClass('seg-distance').text(currentSegmentData.distance))
            .append($('<div>').addClass('seg-fare').text(currentSegmentData.fare));
          if (currentSegmentData.seatFare) {
            $segmentDiv.append($('<div>').addClass('seg-seatfare').text(currentSegmentData.seatFare));
          }
          $timeline.append($segmentDiv);
        }
      });
      $ct.append($trip.append($timeline));
    });
    $ct.find('.trip').first().addClass('active').find('.moreInfo').addClass('active');
  }
  async function triggerSearch(updateURL = true) {
    const allItems = $('#items .item input[name="Location"]');
    const requiredItems = [allItems.eq(0), allItems.eq(1), allItems.eq(allItems.length - 1)];
    const missing = requiredItems.some($el => !$el.val().trim());
    if (missing) {
      $('#notification').addClass('active').html(`
      <ion-icon name="alert-circle-outline"></ion-icon>
      <p>出発地、中継地、到着地の3つすべてを入力してください。</p>`);
      return;
    }

    $('#notification').empty();
    const raw = allItems.map((i, el) => $(el).val().trim()).get();
    const depVal = $('input[name="Departure"]').val(),
      retVal = $('input[name="Return"]').val();

    const filters = {};
    [
      'departOrArrive', 'paymentType', 'discountType', 'commuteType',
      'airplaneUse', 'busUse', 'expressTrainUse',
      'allowCarTaxi', 'allowBike',
      'sort', 'seatPreference', 'preferredTrain',
      'transferTime', 'searchType'
    ].forEach(k => {
      filters[k] = $(`#${k}`).attr('data-current') || '';
    });

    const newP = new URLSearchParams();
    newP.set('from', raw[0]);
    raw.slice(1, -1).forEach((b, i) => {
      newP.append('by', b);
      const $ct = $('#items .item-container').eq(i + 1);
      const stayVal = $ct.find('.destination-setting .selected').attr('value') || '6';
      newP.append('byTime', stayVal);
    });
    newP.set('to', raw[raw.length - 1]);
    newP.set('departure', depVal.replace('T', '_').replace(':', '-'));
    if (retVal) {
      newP.set('return', retVal.replace('T', '_').replace(':', '-'));
    }
    Object.entries(filters).forEach(([k, v]) => newP.set(k, v));
    if (updateURL) {
      window.history.replaceState(null, '', '?' + newP.toString());
    }
    $('#trips').empty().append(`
      <div id="loader" class="active">
        <div class="lds-spinner">${'<div></div>'.repeat(12)}</div>
      </div>`);
    $('.leg').remove();
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
      const $grp = $('<div>').addClass('leg'),
        $list = $('<div>').addClass('trip-list');
      $('#loader').before($grp.append($list));
      try {
        const data = await $.getJSON(url);
        if (data.notification) {
          $('#notification').addClass('active').html(`
            <ion-icon name="alert-circle-outline"></ion-icon>
            <p>${data.notification}</p>
          `);
        }
        renderTrips(data, $list);
        const first = Array.isArray(data.results) ? data.results[0] : data.results.results[0];
        const [arrH, arrM] = first.arrivalTime.split(':').map(Number);
        currentDeparture.setHours(arrH);
        currentDeparture.setMinutes(arrM + stayH * 60);
      } catch (err) {
        $list.append($('<div>').addClass('error').text('データが無効です'));
      }
    }

    for (let i = 0; i < raw.length - 1; i++) {
      const $ct = $('#items .item-container').eq(i + 1);
      const stayH = parseInt($ct.find('.destination-setting .selected').attr('value'), 10) || 0;

      const isLastLeg = i === raw.length - 2;
      if (!retVal || !isLastLeg) {
        await fetchLeg(raw[i], raw[i + 1], i, stayH);
      }
    }

    if (retVal) {
      await fetchLeg(raw[raw.length - 1], raw[0], raw.length - 1);
    }

    let globalDeparture = '', globalArrival = '';
    let totalDistance = 0, totalFare = 0, totalSeatFare = 0;
    let legs = $('.trip');

    legs.each(function (i) {
      const $trip = $(this);
      const dep = $trip.find('.departure .date').text().trim();
      const arr = $trip.find('.arrival .date').text().trim();
      if (i === 0) globalDeparture = dep;
      if (i === legs.length - 1) globalArrival = arr;

      $trip.find('.seg-distance').each(function () {
        const txt = $(this).text().replace(/[^\d.]/g, '');
        totalDistance += parseFloat(txt) || 0;
      });

      $trip.find('.seg-fare').each(function () {
        const txt = $(this).text().replace(/[^\d]/g, '');
        totalFare += parseInt(txt, 10) || 0;
      });

      $trip.find('.seg-seatfare').each(function () {
        const txt = $(this).text().replace(/[^\d]/g, '');
        totalSeatFare += parseInt(txt, 10) || 0;
      });
    });

    const totalFareYen = totalFare.toLocaleString() + '円';
    const totalSeatFareYen = totalSeatFare > 0 ? `+ 指定席 ${totalSeatFare.toLocaleString()}円` : '';
    const totalDistanceKm = totalDistance.toFixed(1) + 'km';

    const summaryHtml = `
    <div class="summary-item header">まとめ</div>
    <div class="summary-item">出発:${globalDeparture}</div>
    <div class="summary-item">到着:${globalArrival}</div>
    <div class="summary-item">距離:${totalDistanceKm}</div>
    <div class="summary-item">合計料金:${totalFareYen} ${totalSeatFareYen}</div>
  `;

    $('#summary').html(summaryHtml).addClass("active");
    $('#loader').removeClass('active');
  }

  $('#trips').off('click', '.trip').on('click', '.trip', function () {
    $(this).toggleClass('active');
    $(this).find('.moreInfo').toggleClass('active');
  });
  $('#items').on('click', '.more', function (e) {
    e.preventDefault();
    if ($('#items .item-container').length >= maxStops + 2) return;
    $('#app').addClass('vertical');
    const $parent = $(this).closest('.item-container');
    $parent.after(createItemContainer('By'));
    refreshMoreIcons();
    refreshCloses();
  });
  $('#items').on('click', '.close', function (e) {
    e.stopPropagation();
    const $ct = $(this).closest('.item-container');
    const idx = $('#items .item-container').index($ct);
    const len = $('#items .item-container').length;
    if (idx > 0 && idx < len - 1) {
      const byIndex = idx - 1;
      const searchParams = new URLSearchParams(window.location.search);
      const bys = searchParams.getAll('by');
      if (byIndex >= 0 && byIndex < bys.length) {
        bys.splice(byIndex, 1);
      }
      searchParams.delete('by');
      bys.forEach(b => searchParams.append('by', b));
      let byTimes = searchParams.getAll('byTime');
      if (byIndex >= 0 && byIndex < byTimes.length) {
        byTimes.splice(byIndex, 1);
      }
      searchParams.delete('byTime');
      byTimes.forEach(t => searchParams.append('byTime', t));
      window.history.replaceState(null, '', '?' + searchParams.toString());
    }
    $ct.remove();
    refreshMoreIcons();
    refreshCloses();
    triggerSearch();
  });
  $('#items').on('input', 'input[name="Location"]', function () {
    const $ct = $(this).closest('.item-container');
    const idx = $('#items .item-container').index($ct);
    const tot = $('#items .item-container').length;
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
  });
  $('#items').on('click', '.destination-setting div', function () {
    const $opt = $(this);
    const $grp = $opt.closest('.destination-setting');
    $grp.find('div').removeClass('selected');
    $opt.addClass('selected');
    const $container = $opt.closest('.item-container');
    const idx = $('#items .item-container').index($container);
    const stayTime = $opt.attr('value');
    const searchParams = new URLSearchParams(window.location.search);
    const bys = searchParams.getAll('by');
    const byCount = $('#items .item-container').length - 2;
    let byTimes = searchParams.getAll('byTime');
    while (byTimes.length < byCount) {
      byTimes.push('6');
    }
    if (byTimes.length > byCount) {
      byTimes = byTimes.slice(0, byCount);
    }
    const byIndex = idx - 1;
    if (byIndex >= 0 && byIndex < byCount) {
      byTimes[byIndex] = stayTime;
    }
    if (byCount !== bys.length) {
      searchParams.delete('by');
      $('#items .item-container').slice(1, -1).each(function () {
        const val = $(this).find('input[name="Location"]').val();
        searchParams.append('by', val);
      });
    }
    searchParams.delete('byTime');
    byTimes.forEach(t => searchParams.append('byTime', t));
    window.history.replaceState(null, '', '?' + searchParams.toString());
    setTimeout(() => {
      triggerSearch();
    }, 500);
  });
  function showCalendar() {
    const $dates = $('#dates');
    const ofs = $dates.offset();
    const h = $dates.outerHeight();
    $('#calendar').css({
      top: ofs.top + h + 5,
      left: ofs.left,
      position: 'absolute'
    }).show();
  }
  $('#departure, #arrival').on('click', function (e) {
    e.stopPropagation();
    $('#calendar').hide();
    showCalendar();
  });
  $('#departure, #arrival').on('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const search = new URLSearchParams(window.location.search);
      search.set('departure', $('#departure').val());
      const ret = $('#arrival').val();
      if (ret) {
        search.set('return', ret);
      } else {
        search.delete('return');
      }
      window.history.replaceState(null, '', '?' + search.toString());
      $('#calendar').hide();
      triggerSearch();
    }
  });
  $(document).on('click', function (e) {
    if ($('#calendar').is(':visible') && !$(e.target).closest('#calendar').length) {
      $('#calendar').hide();
      triggerSearch();
    }
  });
  const slider = document.querySelector('#settings-list');
  let isDown = false, startX, scrollLeft;
  slider.addEventListener('mousedown', e => {
    isDown = true;
    slider.classList.add('active');
    startX = e.pageX - slider.offsetLeft;
    scrollLeft = slider.scrollLeft;
  });
  slider.addEventListener('mouseleave', () => {
    isDown = false;
    slider.classList.remove('active');
  });
  slider.addEventListener('mouseup', () => {
    isDown = false;
    slider.classList.remove('active');
  });
  slider.addEventListener('mousemove', e => {
    if (!isDown) return;
    e.preventDefault();
    const x = e.pageX - slider.offsetLeft;
    const walk = x - startX;
    slider.scrollLeft = scrollLeft - walk;
  });
  $('#settings-list').on('click', '.setting-group', function (e) {
    e.stopPropagation();
    const $this = $(this);
    $('.setting-group.open').not($this).removeClass('open');
    $this.toggleClass('open');
  });
  $(document).on('click', function (e) {
    if (!$(e.target).closest('.setting-group').length) {
      $('.setting-group.open').removeClass('open');
    }
  });
  $('#settings-list').on('click', '.select div[value]', function (e) {
    e.stopPropagation();
    const $opt = $(this);
    const $sel = $opt.closest('.select');
    const val = $opt.attr('value');
    $sel.attr('data-current', val);
    $sel.children().removeClass('selected');
    $opt.addClass('selected');
    triggerSearch();
  });
  $('#submit').click(e => {
    e.preventDefault();
    triggerSearch();
  });
  $('#formContainer').on('keydown', 'input,select', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      triggerSearch();
    }
  });
  $('#notification').click(() => {
    $('#notification').removeClass('active');
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
      if (name) {
        $fromField.val(name);
      }
    });
  }
});
