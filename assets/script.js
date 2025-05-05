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
            return best && (best.tags && (best.tags['name:ja'] || best.tags.name)) || null;
        } catch {
            return null;
        }
    }

    function formatDateWithoutYear(dateTimeStr) {
        const datePart = dateTimeStr.split(' ')[0];
        const parts = datePart.split('/');
        if (parts.length !== 3) return dateTimeStr;
        const mm = parts[1].padStart(2, '0');
        const dd = parts[2].padStart(2, '0');
        return `${mm}/${dd}`;
    }

    function getNotificationMessage(key) {
        switch (key) {
            case 'no_result':
                return '検索結果が見つかりませんでした。';
            case 'no_result_with_expressTrainUse_forbid':
                return '特急利用不可では結果がありませんでした。特急利用を許可して再検索しました。';
            case 'no_result_with_airplaneUse_forbid':
                return '飛行機利用不可では結果がありませんでした。飛行機利用を許可して再検索しました。';
            case 'no_result_with_busUse_forbid':
                return 'バス利用不可では結果がありませんでした。バス利用を許可して再検索しました。';
            default:
                return '';
        }
    }

    const params = new URLSearchParams(window.location.search);
    function prefill() {
        const locs = params.getAll('from');
        const tos = params.getAll('to');
        $('#items').empty();

        if (locs.length) {
            locs.forEach((f, i) => {
                $('#items').append(
                    `<div class="item"><span>From:</span><input type="text" name="Location" value="${f}" placeholder="…"></div>`
                );
                if (tos[i]) {
                    $('#items').append(
                        `<div class="item"><span>To:</span><input type="text" name="Location" value="${tos[i]}" placeholder="…"></div>`
                    );
                }
            });
        } else {
            $('#items').append(`
                <div class="item"><span>From:</span><input type="text" name="Location" id="from" placeholder="東京"></div>
                <div class="item"><span>To:</span><input type="text" name="Location" placeholder="大阪"></div>
            `);
        }

        $('input[name="Departure"]').val(
            params.has('departure') ? params.get('departure') : new Date().toISOString().slice(0, 16)
        );
        if (params.has('return')) {
            $('input[name="Return"]').val(params.get('return'));
        }
        ['departOrArrive', 'paymentType', 'discountType', 'commuteType', 'airplaneUse', 'busUse', 'expressTrainUse', 'allowCarTaxi', 'allowBike', 'sort', 'seatPreference', 'preferredTrain', 'transferTime', 'searchType']
            .forEach(k => {
                if (params.has(k)) {
                    const val = params.get(k);
                    $(`#${k}`).attr('data-current', val)
                        .children(`div[value="${val}"]`).addClass('selected');
                }
            });
    }
    prefill();

    const $fromField = $('#from');
    if ($fromField.length && !$fromField.val()) {
        navigator.geolocation.getCurrentPosition(async pos => {
            const name = await findNearestStation(pos.coords.latitude, pos.coords.longitude);
            if (name) $fromField.val(name);
        });
    }

    function renderTrips(data, $container) {
        // Normalize data.results array
        let arr = [];
        if (Array.isArray(data.results)) {
            arr = data.results;
        } else if (data.results && Array.isArray(data.results.results)) {
            arr = data.results.results;
        }
        if (!arr.length) {
            $container.append('<div class="error">データが無効です</div>');
            return;
        }
        const trip = arr[0];
        const $trip = $('<div>').addClass('trip');
        const $top = $('<div>').addClass('trip-data top');
        const $leftInfo = $('<div>').addClass('left-info');
        const $rightInfo = $('<div>').addClass('right-info');

        // Build info
        const shortDate = formatDateWithoutYear(trip.date);
        const $info = $('<div>').addClass('info')
            .append(
                $('<div>').addClass('departure')
                    .append($('<div>').addClass('date').text(`${shortDate} ${trip.departureTime}`))
                    .append($('<div>').addClass('place').text(trip.stations[0]?.stationName || ''))
            )
            .append(
                $('<div>').addClass('arrival')
                    .append($('<div>').addClass('date').text(
                        trip.date.includes('→') ? trip.arrivalTime : `${shortDate} ${trip.arrivalTime}`
                    ))
                    .append($('<div>').addClass('place').text(trip.stations.slice(-1)[0]?.stationName || ''))
            );
        $leftInfo.append($info);
        $rightInfo.html('<div class="moreInfo"><ion-icon name="chevron-down-outline"></ion-icon></div>');

        const $meta = $('<div>').addClass('bottom')
            .append($('<div>').addClass('duration').html(`<span>時間</span>${trip.duration}`))
            .append($('<div>').addClass('transfers').html(`<span>乗換</span>${trip.transfers}`))
            .append($('<div>').addClass('emission').html(`<span>CO₂</span>${trip.co2.emission}`))
            .append($('<div>').addClass('co2-red').html(`<span>自動車比</span>${trip.co2.reduction}`))
            .append($('<div>').addClass('price').html(`<span>総額</span>${trip.price}`));
        $leftInfo.append($meta);
        $top.append($leftInfo, $rightInfo);
        $trip.append($top);

        // Build timeline
        const changeMap = {};
        trip.changes.forEach(ch => { changeMap[ch.stationName] = ch; });

        function makeStop(name) {
            const $st = $('<div>').addClass('stop');
            const ch = changeMap[name];
            if (ch) {
                const $detail = $('<div>').addClass('stop-change');
                if (ch.transferTime) $detail.append($('<div>').text(`乗換: ${ch.transferTime}`));
                if (ch.waitTime) $detail.append($('<div>').text(`待ち: ${ch.waitTime}`));
                const station = trip.stations.find(s => s.stationName === name);
                if (station && station.nonStop) {
                    $detail.append($('<div>').text('≪降車不要≫').css({ color: '#666', 'font-style': 'italic', 'font-size': '90%' }));
                }
                $st.append($detail);
            }
            $st.append($('<span>').addClass('stop-dot'))
                .append($('<div>').addClass('stop-label').text(name));
            if (ch) {
                const $detail2 = $('<div>').addClass('stop-change2');
                if (ch.arrivalPlatform) $detail2.append($('<div>').text(`着線: ${ch.arrivalPlatform}`));
                if (ch.departurePlatform) $detail2.append($('<div>').text(`発線: ${ch.departurePlatform}`));
                if ($detail2.children().length) $st.append($detail2);
            }
            return $st;
        }

        const $timeline = $('<div>').addClass('timeline');
        $timeline.append(makeStop(trip.stations[0]?.stationName || ''));
        trip.segments.forEach((seg, idx) => {
            const $seg = $('<div>').addClass('segment');
            const $segTiming = $('<div>').addClass('segTiming');
            const $line = $('<div>').addClass('seg-line');
            $segTiming.append($line)
                .append($('<div>').addClass('seg-time').text(`${seg.departure} → ${seg.arrival}`))
                .append($('<div>').addClass('seg-duration').text(seg.duration));
            if (seg.color) {
                const $col = $('<span>').addClass('line-color').css({ 'background-color': seg.color, 'border-color': seg.color });
                if (seg.striped) $col.addClass('stripe');
                $line.append($col);
            }
            if (seg.trainType === 'ＪＲ') {
                $line.append($('<span>').addClass('train-type'));
            } else if (seg.trainType) {
                $line.append($('<span>').addClass('train-type'));
            }
            $line.append(seg.timeLink ? $('<p>').text(seg.line) : $('<span>').text(seg.line));
            $seg.append($line)
                .append($('<div>').addClass('seg-distance').text(seg.distance))
                .append($('<div>').addClass('seg-fare').text(seg.fare));
            $timeline.append($seg);
            $seg.prepend($segTiming);
            const nextName = trip.stations[idx + 1]?.stationName || '';
            $timeline.append(makeStop(nextName));
        });

        $trip.append($timeline);
        $container.append($trip);
    }

    async function triggerSearch(updateURL = true) {
        const raw = $('#items .item input[name="Location"]').map((i, el) => el.value.trim()).get();
        if (raw.length < 2) {
            $('#notification').addClass('active').html('<ion-icon name="alert-circle-outline"></ion-icon><p>出発地と到着地を2つ以上入力してください。</p>');
            return;
        }
        $('#notification').empty();
        const depVal = $('input[name="Departure"]').val();
        const [YMD, HMS] = depVal.split('T');
        const [year, month, day] = YMD.split('-');
        const [hour, minute] = HMS.split(':');
        const base = { year, month, day, hour, minute };
        ['departOrArrive', 'paymentType', 'discountType', 'commuteType', 'airplaneUse', 'busUse', 'expressTrainUse', 'allowCarTaxi', 'allowBike', 'sort', 'seatPreference', 'preferredTrain', 'transferTime', 'searchType']
            .forEach(k => base[k] = $(`#${k}`).attr('data-current') || '');

        const newP = new URLSearchParams();
        raw.forEach((v, i) => newP.append(i % 2 === 0 ? 'from' : 'to', v));
        newP.set('departure', depVal);
        const ret = $('input[name="Return"]').val(); if (ret) newP.set('return', ret);
        Object.entries(base).forEach(([k, v]) => newP.set(k, v));
        if (updateURL) history.replaceState(null, '', '?' + newP);

        $('#trips').empty();
        for (let i = 0; i < raw.length - 1; i++) {
            const from = raw[i], to = raw[i + 1];
            const params = { ...base, from, to };
            const url = 'http://localhost:3000/scrape?' + $.param(params);
            const $grp = $('<div>').addClass('leg');
            const $list = $('<div>').addClass('trip-list');
            $grp.append($list);
            $('#trips').append($grp);
            try {
                const data = await $.getJSON(url);
                const notificationKey = data.notification || data.results?.notification;
                if (notificationKey) {
                    $('#notification').addClass('active').html("<ion-icon name='alert-circle-outline'></ion-icon><p>" + getNotificationMessage(notificationKey) + "</p>");
                }
                renderTrips(data, $list);
            } catch {
                $('#notification').addClass('active').html('<ion-icon name="alert-circle-outline"></ion-icon><p>エラーが発生しました。しばらくしてから再度お試しください。</p>');
                $list.append($('<div>').addClass('error').text('Erreur'));
            }
        }
    }

    $('#submit').click(e => { e.preventDefault(); triggerSearch(); });
    $('#formContainer').on('keydown', 'input, select', e => { if (e.key === 'Enter') { e.preventDefault(); triggerSearch(); } });
    $('.select').on('click', 'div[value]', function (e) {
        e.stopPropagation();
        const $this = $(this);
        const val = $this.attr('value');
        const $sel = $this.closest('.select');
        $sel.attr('data-current', val).children().removeClass('selected');
        $this.addClass('selected');
        triggerSearch();
    });

    if (params.has('from') && params.has('to')) {
        triggerSearch(false);
    }
});
