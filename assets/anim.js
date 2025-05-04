$(document).ready(function () {
    function applySettingsRowLimit() {
        const $container = $('#settings-content');
        const containerWidth = $container.innerWidth();
        const gap = 5;

        const $groups = $container.find('.setting-group');
        const $more = $('<div class="more-settings"><ion-icon name="add-outline"></ion-icon> More Settings</div>');
        $container.append($more);
        const moreWidth = $more.outerWidth(true);
        $more.remove();

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

        $select.css({
            top: offset.top + height + 5,
            left: offset.left
        });

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

    let resizeTimeout;
    $(window).on('resize', function () {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => location.reload(), 100);
    });

    $(window).on('load', function () {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                applySettingsRowLimit();
            });
        });
    });
});
