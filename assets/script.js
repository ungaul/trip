$(document).ready(function () {
    function haversine(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const toRad = d => d * Math.PI / 180;
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    async function findNearestStation(lat, lon) {
        const query = `[out:json];node(around:5000,${lat},${lon})[railway=station];out;`;
        const url = 'https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(query);
        try {
            const resp = await fetch(url);
            const json = await resp.json();
            let best = null, minDist = Infinity;
            json.elements.forEach(n => {
                const d = haversine(lat, lon, n.lat, n.lon);
                if (d < minDist) { minDist = d; best = n; }
            });
            return best && ((best.tags['name:ja']) || best.tags.name) || null;
        } catch {
            return null;
        }
    }

    function formatDateWithoutYear(s) {
        const p = s.split(' ')[0].split('/');
        if (p.length !== 3) return s;
        return p[1].padStart(2, '0') + '/' + p[2].padStart(2, '0');
    }

    function getNotificationMessage(key) {
        switch (key) {
            case 'no_result': return '検索結果が見つかりませんでした。';
            case 'no_result_with_expressTrainUse_forbid': return '特急利用不可では結果がありませんでした。特急利用を許可して再検索しました。';
            case 'no_result_with_airplaneUse_forbid': return '飛行機利用不可では結果がありませんでした。飛行機利用を許可して再検索しました。';
            case 'no_result_with_busUse_forbid': return 'バス利用不可では結果がありませんでした。バス利用を許可して再検索しました。';
            default: return '';
        }
    }

    function removeURLParam(param, value) {
        const url = new URL(window.location.href);
        const ps = url.searchParams;
        const arr = ps.getAll(param);
        ps.delete(param);
        arr.filter(v => v !== value).forEach(v => ps.append(param, v));
        history.replaceState(null, '', url.pathname + '?' + ps.toString());
    }

    const params = new URLSearchParams(window.location.search);

    function refreshMore() {
        $('#items .item').each(function (i) {
            const $it = $(this);
            $it.find('.more').remove().end()
                .find('.stay-duration').remove();
            if (i < $('#items .item').length - 1) {
                $it.append('<div class="more"><ion-icon name="add-outline"></ion-icon></div>');
            }
            if (i > 0 && i < $('#items .item').length - 1) {
                $it.append('<ion-icon class="close" name="close-outline"></ion-icon>');
            }
        });
    }

    function prefill() {
        const froms = params.getAll('from'), tos = params.getAll('to');
        $('#items').empty();
        if (froms.length) {
            froms.forEach((f, i) => {
                $('#items').append(`<div class="item"><span>From:</span><input type="text" name="Location" value="${f}" placeholder="…"></div>`);
                if (tos[i]) {
                    $('#items').append(`<div class="item"><span>To:</span><input type="text" name="Location" value="${tos[i]}" placeholder="…"></div>`);
                }
            });
        } else {
            $('#items').append('<div class="item"><span>From:</span><input type="text" id="from" name="Location" placeholder="東京"></div>');
            $('#items').append('<div class="item"><span>To:</span><input type="text" name="Location" placeholder="大阪"></div>');
        }
        $('input[name="Departure"]').val(params.get('departure') || new Date().toISOString().slice(0, 16));
        if (params.has('return')) $('input[name="Return"]').val(params.get('return'));
        if ($('#items .item').length > 2) $('#app').addClass('vertical');
        refreshMore();
    }
    prefill();

    $('#items').on('click', '.more', function (e) {
        e.preventDefault();
        const cnt = $('#items .item').length;
        if (cnt >= 6) return;
        $('#app').addClass('vertical');
        $(this).closest('.item').after('<div class="item"><span>By:</span><input type="text" name="Location" placeholder="…"></div>');
        refreshMore();
    });

    $('#items').on('click', '.close', function (e) {
        e.stopPropagation();
        const $it = $(this).closest('.item');
        const idx = $it.index(), val = $it.find('input').val().trim();
        const param = (idx % 2 === 0) ? 'from' : 'to';
        removeURLParam(param, val);
        $it.remove();
        refreshMore();
        triggerSearch();
    });

    $('#items').on('input', 'input[name="Location"]', function () {
        const $it = $(this).closest('.item');
        if (!$it.find('.stay-duration').length) {
            $it.append(`
                <div class="stay-duration">
                  <div class="current" data-value="6">6h</div>
                  <div class="setting">
                    <div class="select stay-select">
                      <div value="3">3h</div>
                      <div value="6" class="selected">6h</div>
                      <div value="12">12h</div>
                      <div value="24">24h</div>
                    </div>
                    <ion-icon name="chevron-down-outline"></ion-icon>
                  </div>
                </div>
            `);
        }
    });

    $('#items').on('click', '.stay-duration .current, .stay-duration ion-icon', function (e) {
        e.stopPropagation();
        const $sel = $(this).closest('.stay-duration').find('.select');
        $('.stay-duration .select').not($sel).hide();
        $sel.toggle();
    });

    // sélectionner une option
    $('#items').on('click', '.stay-duration .select div', function (e) {
        const $opt = $(this),
            txt = $opt.text(),
            val = $opt.attr('value'),
            $cont = $opt.closest('.stay-duration');
        $cont.find('.current').text(txt).attr('data-value', val);
        $cont.find('.select').hide();
        $cont.find('.select div').removeClass('selected');
        $opt.addClass('selected');
    });

    // fermer si clique à l’extérieur
    $(document).on('click', function () {
        $('.stay-duration .select').hide();
    });

    const $fromField = $('#from');
    if ($fromField.length && !$fromField.val()) {
        navigator.geolocation.getCurrentPosition(async pos => {
            const name = await findNearestStation(pos.coords.latitude, pos.coords.longitude);
            if (name) $fromField.val(name);
        });
    }

    function renderTrips(data, $ct) {
        let arr = [];
        if (Array.isArray(data.results)) arr = data.results;
        else if (data.results && Array.isArray(data.results.results)) arr = data.results.results;
        if (!arr.length) { $ct.append('<div class="error">データが無効です</div>'); return; }
        const trip = arr[0];
        const $trip = $('<div>').addClass('trip'),
            $top = $('<div>').addClass('trip-data top'),
            $l = $('<div>').addClass('left-info'),
            $r = $('<div>').addClass('right-info'),
            sd = formatDateWithoutYear(trip.date);
        const $info = $('<div>').addClass('info')
            .append($('<div>').addClass('departure')
                .append($('<div>').addClass('date').text(sd + ' ' + trip.departureTime))
                .append($('<div>').addClass('place').text(trip.stations[0]?.stationName || '')))
            .append($('<div>').addClass('arrival')
                .append($('<div>').addClass('date').text(trip.date.includes('→') ? trip.arrivalTime : sd + ' ' + trip.arrivalTime))
                .append($('<div>').addClass('place').text(trip.stations.slice(-1)[0]?.stationName || '')));
        $l.append($info);
        $r.html('<div class="moreInfo"><ion-icon name="chevron-down-outline"></ion-icon></div>');
        const $meta = $('<div>').addClass('bottom')
            .append($('<div>').addClass('duration').html(`<span>時間</span>${trip.duration}`))
            .append($('<div>').addClass('transfers').html(`<span>乗換</span>${trip.transfers}`))
            .append($('<div>').addClass('emission').html(`<span>CO₂</span>${trip.co2.emission}`))
            .append($('<div>').addClass('co2-red').html(`<span>自動車比</span>${trip.co2.reduction}`))
            .append($('<div>').addClass('price').html(`<span>総額</span>${trip.price}`));
        $l.append($meta);
        $top.append($l, $r);
        $trip.append($top);
        const changeMap = {};
        trip.changes.forEach(c => changeMap[c.stationName] = c);
        function makeStop(name) {
            const $st = $('<div>').addClass('stop'), ch = changeMap[name];
            if (ch) {
                const $d = $('<div>').addClass('stop-change');
                if (ch.transferTime) $d.append($('<div>').text(`乗換: ${ch.transferTime}`));
                if (ch.waitTime) $d.append($('<div>').text(`待ち: ${ch.waitTime}`));
                const stn = trip.stations.find(s => s.stationName === name);
                if (stn && stn.nonStop) $d.append($('<div>').text('降車不要').css({ color: '#666', fontStyle: 'italic', fontSize: '90%' }));
                $st.append($d);
            }
            $st.append($('<span>').addClass('stop-dot'))
                .append($('<div>').addClass('stop-label').text(name));
            if (ch) {
                const $d2 = $('<div>').addClass('stop-change2');
                if (ch.arrivalPlatform) $d2.append($('<div>').text(`着線: ${ch.arrivalPlatform}`));
                if (ch.departurePlatform) $d2.append($('<div>').text(`発線: ${ch.departurePlatform}`));
                if ($d2.children().length) $st.append($d2);
            }
            return $st;
        }
        const $timeline = $('<div>').addClass('timeline').append(makeStop(trip.stations[0]?.stationName || ''));
        trip.segments.forEach((seg, i) => {
            const $seg = $('<div>').addClass('segment'),
                $sgt = $('<div>').addClass('segTiming'),
                $ln = $('<div>').addClass('seg-line');
            $sgt.append($ln)
                .append($('<div>').addClass('seg-time').text(`${seg.departure} → ${seg.arrival}`))
                .append($('<div>').addClass('seg-duration').text(seg.duration));
            if (seg.color) {
                const $col = $('<span>').addClass('line-color').css({ backgroundColor: seg.color, borderColor: seg.color });
                if (seg.striped) $col.addClass('stripe');
                $ln.append($col);
            }
            if (seg.trainType) $ln.append($('<span>').addClass('train-type'));
            $ln.append(seg.timeLink ? $('<p>').text(seg.line) : $('<span>').text(seg.line));
            $seg.append($ln)
                .append($('<div>').addClass('seg-distance').text(seg.distance))
                .append($('<div>').addClass('seg-fare').text(seg.fare));
            $timeline.append($seg);
            $seg.prepend($sgt);
            $timeline.append(makeStop(trip.stations[i + 1]?.stationName || ''));
        });
        $trip.append($timeline);
        $ct.append($trip);
    }

    async function triggerSearch(updateURL = true) {
        const raw = $('#items .item input[name="Location"]').map((i, el) => $(el).val().trim()).get();

        if (raw.length < 2) {
            $('#notification').addClass('active').html(`
                <ion-icon name="alert-circle-outline"></ion-icon>
                <p>出発地と到着地を2つ以上入力してください。</p>
            `);
            return;
        }
        $('#notification').empty();

        const depVal = $('input[name="Departure"]').val();
        const [YMD, HMS] = depVal.split('T');
        const [year, month, day] = YMD.split('-');
        const [hour, minute] = HMS.split(':');
        const base = { year, month, day, hour, minute };

        [
            'departOrArrive', 'paymentType', 'discountType', 'commuteType',
            'airplaneUse', 'busUse', 'expressTrainUse', 'allowCarTaxi', 'allowBike',
            'sort', 'seatPreference', 'preferredTrain', 'transferTime', 'searchType'
        ].forEach(k => {
            base[k] = $(`#${k}`).attr('data-current') || '';
        });

        const newP = new URLSearchParams();
        raw.forEach((v, i) => newP.append(i % 2 === 0 ? 'from' : 'to', v));
        newP.set('departure', depVal);
        const ret = $('input[name="Return"]').val();
        if (ret) newP.set('return', ret);
        Object.entries(base).forEach(([k, v]) => newP.set(k, v));

        if (updateURL) {
            window.history.replaceState(null, '', '?' + newP.toString());
        }

        $('#trips').empty();

        // Construire les legs (boucle)
        const legs = [];
        for (let i = 0; i < raw.length; i++) {
            legs.push({
                from: raw[i],
                to: i < raw.length - 1 ? raw[i + 1] : raw[0]
            });
        }

        // Injecter le loader unique après tous les legs
        const loaderHtml = `
          <div id="loader" class="active">
            <div class="lds-spinner">
              ${'<div></div>'.repeat(12)}
            </div>
          </div>`;
        $('#trips').append(loaderHtml);

        let pending = legs.length;

        legs.forEach((leg, index) => {
            const params = { ...base, from: leg.from, to: leg.to };
            const url = 'http://localhost:3000/scrape?' + $.param(params);

            const $grp = $('<div>').addClass('leg');
            const $list = $('<div>').addClass('trip-list');
            $grp.append($list);
            $('#loader').before($grp);

            $.getJSON(url)
                .done(data => {
                    const key = data.notification || data.results?.notification;
                    if (key) {
                        $('#notification').addClass('active').html(`
                    <ion-icon name="alert-circle-outline"></ion-icon>
                    <p>${getNotificationMessage(key)}</p>
                  `);
                    }
                    renderTrips(data, $list);

                    // Étendre automatiquement le premier trajet
                    if (index === 0) {
                        const $first = $grp.find('.trip').first();
                        $first.find('.timeline').addClass('active');
                        $first.find('.moreInfo').addClass('active');
                    }
                })
                .fail(() => {
                    $('#notification').addClass('active').html(`
                  <ion-icon name="alert-circle-outline"></ion-icon>
                  <p>エラーが発生しました。しばらくしてから再度お試しください。</p>
                `);
                    $list.append($('<div>').addClass('error').text('エラー'));
                })
                .always(() => {
                    pending--;
                    if (pending === 0) {
                        // Tous les appels sont terminés, on retire le loader
                        $('#loader').removeClass('active');
                    }
                });
        });
    }

    $('#submit').click(e => { e.preventDefault(); triggerSearch(); });
    $('#formContainer').on('keydown', 'input,select', e => { if (e.key === 'Enter') { e.preventDefault(); triggerSearch(); } });
    $('.select').off('click').on('click', 'div[value]', function (e) {
        e.stopPropagation();
        const $t = $(this), v = $t.attr('value'), $sel = $t.closest('.select');
        $sel.attr('data-current', v).children().removeClass('selected');
        $t.addClass('selected');
        triggerSearch();
    });
    $('#notification').on('click', () => $('#notification').removeClass('active'));
    if (params.has('from') && params.has('to')) triggerSearch(false);

    $('#calendar').html('<input id="fpInline" type="text"/>').hide();
    const fp = flatpickr('#fpInline', {
        inline: true, mode: 'range', enableTime: true, dateFormat: 'Y-m-d\\TH:i', onChange(sel, _, inst) {
            if (sel.length === 1) { $('input[name="Departure"]').val(inst.formatDate(sel[0], 'Y-m-d\\TH:i')); $('input[name="Return"]').val(''); }
            else if (sel.length >= 2) { $('input[name="Departure"]').val(inst.formatDate(sel[0], 'Y-m-d\\TH:i')); $('input[name="Return"]').val(inst.formatDate(sel[1], 'Y-m-d\\TH:i')); triggerSearch(); $('#calendar').hide(); }
        }
    });
    function showCalendar($t) { const off = $t.offset(), h = $t.outerHeight(); $('#calendar').css({ position: 'absolute', top: off.top + h, left: off.left, zIndex: 1000 }).show(); }
    $('#departure').on('click', e => { e.stopPropagation(); fp.clear(); showCalendar($(e.currentTarget)); });
    $('#arrival').on('click', e => { e.stopPropagation(); const d = $('input[name="Departure"]').val(); if (d) fp.setDate([d], false); showCalendar($(e.currentTarget)); });
    $(document).on('click', e => { if (!$(e.target).closest('#calendar,#departure,#arrival').length) $('#calendar').hide(); });
});
