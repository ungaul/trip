$(document).ready(function () {
    let stationData = [];

    // Charger les stations dès le départ
    $.getJSON('assets/data/stations.json', function (data) {
      stationData = data;
    });

    function getNearestStationCoords(cityName) {
      const name = cityName.trim();
      let best = null;
      let minDist = Infinity;

      stationData.forEach(group => {
        group.stations.forEach(st => {
          const names = [group.name_kanji, group.name_romaji, ...group.alternative_names];
          if (names.some(n => n && name.includes(n))) {
            const d = Math.random(); // On garde ce test ici pour simuler une recherche
            if (d < minDist) {
              minDist = d;
              best = { name, lat: st.lat, lon: st.lon };
            }
          }
        });
      });

      return best;
    }

    function distance(a, b) {
      return Math.hypot(a.lat - b.lat, a.lon - b.lon);
    }

    $('#submit').on('click', async function (e) {
      e.preventDefault();

      const rawPoints = [];
      $('#items .item').each(function () {
        const location = $(this).find('input[name="Location"]').val();
        const duration = $(this).find('select[name="Duration"]').val();
        if (location) rawPoints.push({ location, duration });
      });

      // Trouver les points géographiques pour chaque ville
      const geoPoints = rawPoints.map(p => ({
        ...p,
        coords: getNearestStationCoords(p.location)
      })).filter(p => p.coords); // Retirer ceux sans résultat

      if (geoPoints.length < 2) {
        $('#results').text('Pas assez de points trouvés.');
        return;
      }

      const start = geoPoints[0];
      const end = geoPoints[geoPoints.length - 1];
      const middle = geoPoints.slice(1, -1);

      // Tri glouton des villes intermédiaires
      const ordered = [start];
      let current = start;
      const remaining = [...middle];

      while (remaining.length > 0) {
        remaining.sort((a, b) => distance(current.coords, a.coords) - distance(current.coords, b.coords));
        const next = remaining.shift();
        ordered.push(next);
        current = next;
      }

      ordered.push(end);

      // Préparer les paramètres de base
      const baseParams = {
        year: $('#year').val(),
        month: $('#month').val(),
        day: $('#day').val(),
        hour: $('#hour').val(),
        minute: $('#minute').val(),
        departOrArrive: $('#departOrArrive').val(),
        paymentType: $('#paymentType').val(),
        discountType: $('#discountType').val(),
        commuteType: $('#commuteType').val(),
        airplaneUse: $('#airplaneUse').val(),
        busUse: $('#busUse').val(),
        expressTrainUse: $('#expressTrainUse').val(),
        allowCarTaxi: $('#allowCarTaxi').val(),
        allowBike: $('#allowBike').val(),
        sort: $('#sort').val(),
        seatPreference: $('#seatPreference').val(),
        preferredTrain: $('#preferredTrain').val(),
        transferTime: $('#transferTime').val(),
        searchType: $('#searchType').val()
      };

      $('#results').empty();

      // Lancer les requêtes pour chaque transition
      for (let i = 0; i < ordered.length - 1; i++) {
        const from = ordered[i].location.trim();
        const to = ordered[i + 1].location.trim();

        const params = { ...baseParams, from, to };
        const queryString = $.param(params);
        const url = `http://localhost:3000/scrape?${queryString}`;

        try {
          const data = await $.getJSON(url);
          $('#results').append(`<h3>${from} → ${to}</h3><pre>${JSON.stringify(data, null, 2)}</pre>`);
        } catch (error) {
          $('#results').append(`<h3>${from} → ${to}</h3><pre>Erreur : ${error.statusText || error.message}</pre>`);
        }
      }
    });
  });
