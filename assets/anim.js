$(document).ready(function () {
    function applySettingsRowLimit() {
        const $container = $('#settings-content');
        const containerWidth = $container.innerWidth();
        const gap = 5;
        const $groups = $container.find('.setting-group');
        const $moreBtn = $('<div class="more-settings"><ion-icon name="add-outline"></ion-icon> More Settings</div>');
        $container.append($moreBtn);
        const moreWidth = $moreBtn.outerWidth(true);
        $moreBtn.remove();
        let totalWidth = 0, shownCount = 0;
        $groups.each(function () {
            const $el = $(this);
            const w = $el.outerWidth(true) + gap;
            if (totalWidth + w + moreWidth <= containerWidth) {
                $el.show();
                totalWidth += w;
                shownCount++;
            } else {
                $el.hide();
            }
        });
        if (shownCount < $groups.length) {
            if (!$('.more-settings').length) {
                $container.append('<div class="more-settings"><ion-icon name="add-outline"></ion-icon> More Settings</div>');
            }
        } else {
            $('.more-settings').remove();
        }
    }

    $('.setting-group').on('click', function (e) {
        e.stopPropagation();
        const $g = $(this), $sel = $g.find('.select');
        if ($g.hasClass('open')) {
            $g.removeClass('open');
            return;
        }
        $('.setting-group').removeClass('open');
        const off = $g.offset(), h = $g.outerHeight();
        $sel.css({ top: off.top + h + 5, left: off.left });
        $g.addClass('open');
    });

    $(document).on('click', function () {
        $('.setting-group').removeClass('open');
    });

    $(document).on('click', '.more-settings', function () {
        const $btn = $(this), $s = $('#settings');
        if ($s.hasClass('expanded')) {
            $s.removeClass('expanded');
            $btn.html('<ion-icon name="add-outline"></ion-icon> More Settings');
            applySettingsRowLimit();
        } else {
            $s.addClass('expanded');
            $btn.html('<ion-icon name="remove-outline"></ion-icon> Less Settings');
            $('.setting-group').show();
        }
    });

    $(window).on('load', function () {
        requestAnimationFrame(() => requestAnimationFrame(applySettingsRowLimit));
    });

    $('#trips').on('click', '.trip', function () {
        $(this).find('.timeline').toggleClass('active');
    });

    $('#notification').on('click', function () {
        $(this).removeClass('active');
    });

    const maxStops = 4;

    function refreshMoreIcons() {
        const $items = $('#items .item');
        $items.each(function (i) {
            const $it = $(this);
            $it.find('.more').remove();
            if (i < $items.length - 1) {
                $it.append('<div class="more"><ion-icon name="add-outline"></ion-icon></div>');
            }
        });
    }

    function refreshCloses() {
        const $items = $('#items .item');
        const len = $items.length;
        $items.find('.close').remove();
        $items.each(function (i) {
            if (i > 0 && i < len - 1) {
                $(this).append('<ion-icon class="close" name="close-outline"></ion-icon>');
            }
        });
    }

    refreshMoreIcons();
    refreshCloses();

    if ($('#items .item').length > 2) {
        $('#app').addClass('vertical');
    }

    $('#items').on('click', '.more', function (e) {
        e.preventDefault();
        const $all = $('#items .item');
        if ($all.length >= maxStops + 2) return;
        $('#app').addClass('vertical');
        $(this).closest('.item').after(
            '<div class="item"><span>By:</span><input type="text" name="Location" placeholder="…"><ion-icon class="close" name="close-outline"></ion-icon></div>'
        );
        refreshMoreIcons();
        refreshCloses();
    });

    $('#items').on('click', '.item .close', function (e) {
        e.stopPropagation();
        $(this).closest('.item').remove();
        refreshMoreIcons();
        refreshCloses();
    });

    async function triggerSearch(updateURL = true) {
        $('#loader').appendTo('#trips').addClass('active'); // show loader
        // ... existing search logic ...
        // after each leg appended:
        // append loader
        $('.leg').append(`
          <div id="loader" class="active">
            <div class="lds-spinner">
              <div></div><div></div><div></div><div></div>
              <div></div><div></div><div></div><div></div>
              <div></div><div></div><div></div><div></div>
            </div>
          </div>
        `);
        // when all trips rendered:
        $('#loader').removeClass('active');
    }

    $('#submit').click(e => { e.preventDefault(); triggerSearch(); });
});
