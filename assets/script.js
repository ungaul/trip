// assets/script.js
$(document).ready(function () {
    // Haversine formula
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

    // Overpass → nearest station name
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
            if (!best) return null;
            return best.tags && (best.tags['name:ja'] || best.tags.name) || null;
        } catch {
            return null;
        }
    }

    // Parse URL & prefill form
    const params = new URLSearchParams(window.location.search);
    function prefill() {
        const locs = params.getAll('from');
        const tos = params.getAll('to');
        $('#items').empty();

        if (locs.length) {
            locs.forEach((f, i) => {
                $('#items').append(
                    `<div class="item"><span>From:</span>
                       <input type="text" name="Location" value="${f}" placeholder="…">
                     </div>`
                );
                if (tos[i]) {
                    $('#items').append(
                        `<div class="item"><span>To:</span>
                           <input type="text" name="Location" value="${tos[i]}" placeholder="…">
                         </div>`
                    );
                }
            });
        } else {
            $('#items').append(`
                <div class="item"><span>From:</span>
                  <input type="text" name="Location" id="from" placeholder="東京">
                </div>
                <div class="item"><span>To:</span>
                  <input type="text" name="Location" placeholder="大阪">
                </div>
            `);
        }

        // Dates
        if (params.has('departure')) {
            $('input[name="Departure"]').val(params.get('departure'));
        } else {
            $('input[name="Departure"]').val(new Date().toISOString().slice(0,16));
        }
        if (params.has('return')) {
            $('input[name="Return"]').val(params.get('return'));
        }

        // Préfill des selects personnalisés
        const keys = [
            'departOrArrive','paymentType','discountType','commuteType',
            'airplaneUse','busUse','expressTrainUse','allowCarTaxi','allowBike',
            'sort','seatPreference','preferredTrain','transferTime','searchType'
        ];
        keys.forEach(k => {
            if (params.has(k)) {
                const val = params.get(k);
                const $sel = $(`#${k}`);
                $sel.attr('data-current', val);
                $sel.children(`div[value="${val}"]`).addClass('selected');
            }
        });
    }
    prefill();

    // Si on n'a pas de "from" en URL, on géolocalise
    const $fromField = $('#from');
    if ($fromField.length && !$fromField.val()) {
        navigator.geolocation.getCurrentPosition(async pos => {
            const name = await findNearestStation(pos.coords.latitude, pos.coords.longitude);
            if (name) $fromField.val(name);
        });
    }

    // Rendu des résultats
    function renderTrips(data, $container) {
        if (!data || !Array.isArray(data.results)) {
            $container.append('<div class="error">Données invalides</div>');
            return;
        }
        // On ne garde que la première route
        const trip = data.results[0];
        const $trip = $('<div>').addClass('trip');
        const $td   = $('<div>').addClass('trip-data');

        // --- Top summary ---
        const $top  = $('<div>').addClass('top');
        const $info = $('<div>').addClass('info');
        $info.append(
            $('<div>').addClass('departure')
                .append($('<div>').addClass('date').text(`${trip.date} ${trip.departureTime}`))
                .append($('<div>').addClass('place').text(trip.stations[0]?.stationName||''))
        );
        const arrTxt = trip.date.includes('→') ? trip.arrivalTime : `${trip.date} ${trip.arrivalTime}`;
        $info.append(
            $('<div>').addClass('arrival')
                .append($('<div>').addClass('date').text(arrTxt))
                .append($('<div>').addClass('place').text(trip.stations.slice(-1)[0]?.stationName||''))
        );
        $top.append($info);
        const $bot = $('<div>').addClass('bottom');
        $bot.append(
            $('<div>').addClass('duration')
                .append($('<span>').addClass('icon-clock').text('🕒'))
                .append($('<span>').addClass('time').text(trip.duration))
                .append($('<span>').addClass('line').text(trip.segments[0]?.line||''))
        );
        $bot.append(
            $('<div>').addClass('meta').html(
                `乗換: ${trip.transfers} &nbsp;|&nbsp; CO₂: ${trip.co2.emission} / 自動車比 ${trip.co2.reduction}`
            )
        );
        $bot.append($('<div>').addClass('price').text(trip.price));
        $top.append($bot);
        $td.append($top);

        // --- Segments ---
        const $segs = $('<div>').addClass('segments');
        trip.segments.forEach(seg => {
            const $s = $('<div>').addClass('segment');
            $s.append($('<div>').addClass('seg-time').text(`${seg.departure} → ${seg.arrival}`));
            const $line = $('<div>').addClass('seg-line');
            if (seg.color) {
                const $col = $('<span>').addClass('line-color').css({
                    'background-color': seg.color,
                    'border-color': seg.color
                });
                if (seg.striped) $col.addClass('stripe');
                $line.append($col);
            }
            if (seg.timeLink) {
                $line.append($('<a>').attr({ href: seg.timeLink, target: '_blank' }).text(seg.line));
            } else {
                $line.append($('<span>').text(seg.line));
            }
            if (seg.trainType) {
                $line.append($('<span>').addClass('train-type').text(`（${seg.trainType}）`));
            }
            $s.append($line)
              .append($('<div>').addClass('seg-duration').text(seg.duration))
              .append($('<div>').addClass('seg-fare').text(seg.fare))
              .append($('<div>').addClass('seg-distance').text(seg.distance));
            $segs.append($s);
        });
        $td.append($segs);

        // --- Changes ---
        if (Array.isArray(trip.changes)) {
            const $chgs = $('<div>').addClass('changes');
            trip.changes.forEach(ch => {
                $chgs.append(
                    $('<div>').addClass('change')
                        .append($('<div>').addClass('change-station').text(ch.stationName))
                        .append($('<div>').addClass('change-transfer').text(`乗換: ${ch.transferTime}`))
                        .append($('<div>').addClass('change-wait').text(`待ち: ${ch.waitTime}`))
                        .append($('<div>').addClass('change-platforms')
                            .text(`着線: ${ch.arrivalPlatform} / 発線: ${ch.departurePlatform}`))
                );
            });
            $td.append($chgs);
        }

        $trip.append($td);
        $container.append($trip);
    }

    // Recherche et mise à jour de l'URL
    async function triggerSearch(updateURL = true) {
        const raw = $('#items .item input[name="Location"]').map((i,el)=>el.value.trim()).get();
        if (raw.length < 2) {
            $('#trips').text('Veuillez saisir au moins deux lieux.');
            return;
        }
        const depVal = $('input[name="Departure"]').val();
        const [yp, tp] = depVal.split('T');
        const [year,month,day] = yp.split('-');
        const [hour,minute] = tp.split(':');

        // Récupère TOUS les paramètres depuis data-current
        const base = { year,month,day,hour,minute };
        [
            'departOrArrive','paymentType','discountType','commuteType',
            'airplaneUse','busUse','expressTrainUse','allowCarTaxi','allowBike',
            'sort','seatPreference','preferredTrain','transferTime','searchType'
        ].forEach(k => {
            base[k] = $(`#${k}`).attr('data-current') || '';
        });

        console.log('[triggerSearch] Params:', base);

        // Construit la nouvelle URL
        const newParams = new URLSearchParams();
        raw.forEach((v,i)=> newParams.append(i%2===0?'from':'to', v));
        newParams.set('departure', depVal);
        const retVal = $('input[name="Return"]').val();
        if (retVal) newParams.set('return', retVal);
        Object.entries(base).forEach(([k,v])=> newParams.set(k,v));
        if (updateURL) history.replaceState(null,'','?'+newParams.toString());

        $('#trips').empty();
        for (let i=0; i<raw.length-1; i++) {
            const from = raw[i], to = raw[i+1];
            const params = {...base,from,to};
            const url = 'http://localhost:3000/scrape?' + $.param(params);
            const $grp = $('<div>').addClass('leg');
            const $list= $('<div>').addClass('trip-list');
            $grp.append($list);
            $('#trips').append($grp);
            try {
                const data = await $.getJSON(url);
                renderTrips(data, $list);
            } catch {
                $list.append($('<div>').addClass('error').text('Erreur'));
            }
        }
    }

    // Lancement manuel
    $('#submit').click(e=>{ e.preventDefault(); triggerSearch(); });
    $('#formContainer').on('keydown','input, select', e=> {
        if (e.key==='Enter') { e.preventDefault(); triggerSearch(); }
    });

    // Sélection d’une option
    $('.select').on('click','div[value]',function(e){
        e.stopPropagation();
        const $this = $(this);
        const val = $this.attr('value');
        const $sel = $this.closest('.select');
        $sel.attr('data-current', val);
        $sel.children().removeClass('selected');
        $this.addClass('selected');
        console.log(`[SELECT] ${$sel.attr('id')} = ${val}`);
        triggerSearch();
    });

    // Auto-run si on a déjà from/to
    if (params.has('from') && params.has('to')) {
        triggerSearch(false);
    }
});
