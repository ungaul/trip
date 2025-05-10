$(document).ready(function () {
    $('#trips').off('click', '.trip').on('click', '.trip', function () {
        $(this).toggleClass('active');
        $(this).find('.moreInfo').toggleClass('active');
    });

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
            byTimes = params.getAll('byTime'), // Get the byTime values from the URL
            to = params.get('to') || '';
        $('#items').empty();
        $('#items').append(createItemContainer('From', from));

        // Append 'by' and corresponding 'byTime' values
        bys.forEach((b, index) => {
            $('#items').append(createItemContainer('By', b));

            // Set waiting time for each "by" stop based on the byTime parameter
            const byTime = byTimes[index] || '6'; // Default to 6 hours if not specified
            const $lastItem = $('#items .item-container').last();
            $lastItem.append(`
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
    refreshMoreIcons(); refreshCloses();

    $('#items').on('click', '.more', function (e) {
        e.preventDefault();
        if ($('#items .item-container').length >= maxStops + 2) return;
        $('#app').addClass('vertical');
        const $parent = $(this).closest('.item-container');
        $parent.after(createItemContainer('By'));
        refreshMoreIcons(); refreshCloses();
    });

    $('#items').on('click', '.item-container .close', function (e) {
        e.stopPropagation();
        const $ct = $(this).closest('.item-container');
        const value = $ct.find('input[name="Location"]').val(); // Get the value of the 'By' location

        // Remove the corresponding 'by' parameter from the URL
        const searchParams = new URLSearchParams(window.location.search);
        let bys = searchParams.getAll('by');
        const indexToRemove = bys.indexOf(value);
        if (indexToRemove > -1) {
            bys.splice(indexToRemove, 1); // Remove the specific "by" from the list
        }

        // Update the 'by' parameters in the URL
        searchParams.delete('by'); // First delete all the existing 'by' params
        bys.forEach(b => searchParams.append('by', b)); // Re-add the remaining 'by' values

        // Update the URL without reloading the page
        window.history.replaceState(null, '', '?' + searchParams.toString());

        // Remove the item from the DOM
        $ct.remove();

        // Refresh the "more" and "close" icons
        refreshMoreIcons();
        refreshCloses();

        // Trigger search to update the results with the updated URL parameters
        triggerSearch();
    });

    $('#items').on('input', 'input[name="Location"]', function () {
        const $ct = $(this).closest('.item-container');
        const idx = $('#items .item-container').index($ct);
        const total = $('#items .item-container').length;
        if (idx > 0 && idx < total - 1 && !$ct.find('.stay-duration').length) {
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
    }); $('#items').on('click', '.destination-setting div', function () {
        const $opt = $(this),
            $grp = $opt.closest('.destination-setting');

        $grp.find('div').removeClass('selected');
        $opt.addClass('selected');

        // Get the selected waiting time for this stop
        const $container = $opt.closest('.item-container');
        const idx = $('#items .item-container').index($container);
        const stayTime = $opt.attr('value');

        // Get the 'by' location value
        const searchParams = new URLSearchParams(window.location.search);
        const byLocations = searchParams.getAll('by');

        // Set the 'byTime' parameter for the selected 'by' location
        let byTimes = searchParams.getAll('byTime');
        if (byTimes[idx]) {
            byTimes[idx] = stayTime; // Update existing byTime if exists
        } else {
            byTimes.push(stayTime); // Add a new byTime if it doesn't exist
        }

        // Update the URL parameters with the new 'byTime' values
        searchParams.delete('byTime');
        byTimes.forEach(t => searchParams.append('byTime', t));

        // Replace the current URL with the updated parameters without reloading the page
        window.history.replaceState(null, '', '?' + searchParams.toString());

        // Only trigger search if necessary (after final selection or changes)
        // For example, you can debounce or limit it based on user interaction
        setTimeout(() => {
            triggerSearch();
        }, 500); // 500ms delay before triggering the search
    });


    $(document).on('click', () => $('.stay-duration .select').hide());

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

    $('#departure').on('click', e => {
        e.stopPropagation();
        $('#calendar').hide();
        showCalendar($(e.currentTarget));
    });
    $('#arrival').on('click', e => {
        e.stopPropagation();
        showCalendar($(e.currentTarget));
    });

    $(document).on('click', e => {
        if (!$(e.target).closest('#calendar, #departure, #arrival').length) {
            $('#calendar').hide();
        }
    });

    $('#departure, #arrival').on('click', function (e) {
        e.stopPropagation();
        showCalendar();
    });

    $('#departure, #arrival').on('keydown', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            const search = new URLSearchParams(window.location.search);
            search.set('departure', $('#departure').val());
            const ret = $('#arrival').val();
            if (ret) search.set('return', ret);
            else search.delete('return');
            window.history.replaceState(null, '', '?' + search.toString());
            $('#calendar').hide();
            triggerSearch(); // Trigger search when calendar changes
        }
    });

    // Re-trigger the search if the calendar is hidden
    $(document).on('click', function (e) {
        if (!$(e.target).closest('#calendar').length) {
            $('#calendar').hide();
            triggerSearch();
        }
    });

    const slider = document.querySelector('#settings-list');
    let isDown = false, startX, scrollLeft;
    slider.addEventListener('mousedown', (e) => {
        isDown = true; slider.classList.add('active');
        startX = e.pageX - slider.offsetLeft;
        scrollLeft = slider.scrollLeft;
    });
    slider.addEventListener('mouseleave', () => {
        isDown = false; slider.classList.remove('active');
    });
    slider.addEventListener('mouseup', () => {
        isDown = false; slider.classList.remove('active');
    });
    slider.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - slider.offsetLeft, walk = (x - startX);
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

    $('#settings-list').on('click', '.select div', function (e) {
        e.stopPropagation();
        const $opt = $(this);
        const key = $opt.closest('.select').attr('id');
        const val = $opt.attr('value');
        $opt.addClass('selected').siblings().removeClass('selected');
        const search = new URLSearchParams(window.location.search);
        search.set(key, val);
        window.history.replaceState(null, '', '?' + search.toString());
        triggerSearch(); // Re-trigger search when a setting changes
    });
});
