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

        let totalWidth = 0;
        let shownCount = 0;

        $groups.each(function () {
            const $el = $(this);
            const itemWidth = $el.outerWidth(true) + gap;

            if (totalWidth + itemWidth + moreWidth <= containerWidth) {
                $el.show();
                totalWidth += itemWidth;
                shownCount++;
            } else {
                $el.hide();
            }
        });

        if (shownCount < $groups.length) {
            if ($('.more-settings').length === 0) {
                $container.append('<div class="more-settings"><ion-icon name="add-outline"></ion-icon> More Settings</div>');
            }
        } else {
            $('.more-settings').remove();
        }
    }

    $('.setting-group').on('click', function (e) {
        e.stopPropagation();
        const $group = $(this);
        const $select = $group.find('.select');

        if ($group.hasClass('open')) {
            $group.removeClass('open');
            return;
        }

        $('.setting-group').removeClass('open');

        const offset = $group.offset();
        const height = $group.outerHeight();

        $select.css({ top: offset.top + height + 5, left: offset.left });
        $group.addClass('open');
    });

    $(document).on('click', function () {
        $('.setting-group').removeClass('open');
    });

    $(document).on('click', '.more-settings', function () {
        const $btn = $(this);
        const $settings = $('#settings');
        if ($settings.hasClass('expanded')) {
            $settings.removeClass('expanded');
            $btn.html('<ion-icon name="add-outline"></ion-icon> More Settings');
            applySettingsRowLimit();
        } else {
            $settings.addClass('expanded');
            $btn.html('<ion-icon name="remove-outline"></ion-icon> Less Settings');
            $('.setting-group').show();
        }
    });

    $(window).on('load', function () {
        requestAnimationFrame(() => requestAnimationFrame(applySettingsRowLimit));
    });

    $('#trips').on('click', '.trip', function () {
        $(this).find('.timeline').toggleClass('active');
        $('.moreInfo').toggleClass('active');
    });

    $('#notification').on('click', function () {
        $(this).removeClass('active');
    });

    // Initialize dynamic intermediate stops UI
    const maxStops = 5;
    function insertMoreButtons() {
        $('#items .item').each(function () {
            if (!$(this).prev().hasClass('more')) {
                $(this).before('<div class="more"><ion-icon name="add-outline"></ion-icon></div>');
            }
        });
    }
    insertMoreButtons();

    // Add new stop after clicking +
    $('#items').on('click', '.more', function (e) {
        e.preventDefault();
        const $allItems = $('#items .item');
        const currentStops = $allItems.length - 1; // initial from/to count = 2
        if (currentStops < maxStops + 2) {
            const $newItem = $(
                '<div class="item">' +
                    '<span>To:</span>' +
                    '<input type="text" name="Location" placeholder="…">' +
                    '<ion-icon name="close-outline"></ion-icon>' +
                '</div>'
            );
            $(this).after($newItem);
            insertMoreButtons();
        }
    });

    // Remove stop on close
    $('#items').on('click', '.item ion-icon[name="close-outline"]', function (e) {
        e.stopPropagation();
        const $item = $(this).closest('.item');
        $item.prev('.more').remove();
        $item.remove();
    });
});
