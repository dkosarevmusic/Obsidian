/**
 * @file task-utils.js
 * Вспомогательные функции для работы с задачами.
 */
if (!window.OJSC) window.OJSC = {};
if (!OJSC.utils) OJSC.utils = {};

OJSC.utils.task = {
    /**
     * Форматирует числовое время (например, 1430) в строку "ЧЧ:ММ".
     * @param {number|string} time - Время для форматирования.
     * @returns {string} - Отформатированное время.
     */
    formatTime: (time) => {
        if (time === null || typeof time === 'undefined') return '';
        const timeString = String(time).padStart(4, '0');
        return `${timeString.slice(0, 2)}:${timeString.slice(2, 4)}`;
    },

    /**
     * Генерирует стили для элемента задачи на основе цвета области (Area).
     * @param {string} area - Название области задачи.
     * @returns {{backgroundColor: string, color: string, borderColor: string}}
     */
    getStyles: (area) => {
        const colorMap = OJSC.config.areaColors;
        let hslColor = colorMap[area] || 'hsl(0,0%,80%)'; // Цвет по умолчанию

        const match = hslColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
        if (match) {
            const [, h, s, l] = match.map(Number);
            const threshold = OJSC.config.darkColorLightnessThreshold;

            if (l < threshold) {
                return {
                    backgroundColor: `hsla(${h},${s}%,${l}%,0.1)`,
                    color: `hsl(${h},${s}%,75%)`,
                    borderColor: `hsl(${h},${s}%,${l}%)`
                };
            }
        }

        return {
            backgroundColor: hslColor.replace('hsl(', 'hsla(').replace(')', ',0.2)'),
            color: hslColor,
            borderColor: hslColor
        };
    },

    /**
     * Сравнивает две задачи для комплексной сортировки.
     * @param {object} a - Первая задача.
     * @param {object} b - Вторая задача.
     * @returns {number}
     */
    compare: (a, b) => {
        const aStatus = Array.isArray(a.status) ? a.status : [String(a.status)];
        const bStatus = Array.isArray(b.status) ? b.status : [String(b.status)];

        function compareTime(timeA, timeB) {
            let tA = timeA === null || typeof timeA === 'undefined' ? '' : timeA;
            let tB = timeB === null || typeof timeB === 'undefined' ? '' : timeB;

            if (typeof tA === 'number') tA = String(tA).padStart(4, '0');
            if (typeof tB === 'number') tB = String(tB).padStart(4, '0');

            return String(tA).localeCompare(String(tB));
        }

        function getComparableString(field, isLink = false) {
            if (!field) return "";
            const arr = Array.isArray(field) ? field : [field];
            const items = isLink
                ? arr.map(l => (typeof l === 'string' ? l : l.path))
                : arr.map(String);
            return items.sort().join('|');
        }

        return (
            // 1. По времени
            (!!b.time - !!a.time) ||
            compareTime(a.time, b.time) ||

            // 2. По статусу "important"
            (bStatus.includes('important') || false) - (aStatus.includes('important') || false) ||

            // 3. По остальным полям
            getComparableString(aStatus).localeCompare(getComparableString(bStatus)) ||
            getComparableString(a.Area).localeCompare(getComparableString(b.Area)) ||
            getComparableString(a.wikilinks, true).localeCompare(getComparableString(b.wikilinks, true)) ||

            // 4. По имени файла
            a.file.name.localeCompare(b.file.name)
        );
    },
};