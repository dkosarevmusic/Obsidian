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
     * Определяет категорию задачи на основе полей 'important' и 'urgent'.
     * @param {object} task - Задача для анализа.
     * @returns {string|null} - Имя категории ('now', 'later', 'probably', 'dont') или null.
     */
    getTaskCategory: (task) => {
        const isImportantSet = typeof task.important === 'boolean';
        const isUrgentSet = typeof task.urgent === 'boolean';

        // Если ни одно из полей не имеет значения true/false, не присваиваем категорию
        if (!isImportantSet && !isUrgentSet) {
            return null;
        }

        // Если хотя бы одно поле задано, отсутствующее считаем false
        const important = isImportantSet ? task.important : false;
        const urgent = isUrgentSet ? task.urgent : false;

        if (important && urgent) return 'now';
        if (important && !urgent) return 'later';
        if (!important && urgent) return 'probably';
        if (!important && !urgent) return 'dont';

        return null;
    },

    /**
     * Сравнивает две задачи для комплексной сортировки.
     * @param {object} a - Первая задача.
     * @param {object} b - Вторая задача.
     * @returns {number}
     */
    compare: (a, b) => {
        // Карта для определения порядка категорий. Задачи без категории получают высокий индекс.
        const categoryOrder = { now: 1, later: 2, probably: 3, dont: 4 };

        const aCategory = OJSC.utils.task.getTaskCategory(a);
        const bCategory = OJSC.utils.task.getTaskCategory(b);

        const aCategoryOrder = aCategory ? categoryOrder[aCategory] : 99;
        const bCategoryOrder = bCategory ? categoryOrder[bCategory] : 99;
        
        const aHasTime = a.time !== null && typeof a.time !== 'undefined';
        const bHasTime = b.time !== null && typeof b.time !== 'undefined';

        // 1. Задачи со временем всегда выше задач без времени
        if (aHasTime && !bHasTime) return -1;
        if (!aHasTime && bHasTime) return 1;

        // 2. Если обе задачи со временем, сортируем по времени
        if (aHasTime && bHasTime) {
            const timeComparison = String(a.time).padStart(4, '0').localeCompare(String(b.time).padStart(4, '0'));
            if (timeComparison !== 0) return timeComparison;
        }

        // 3. Если у обеих задач нет времени, сортируем по категориям
        const categoryComparison = aCategoryOrder - bCategoryOrder;
        if (categoryComparison !== 0) return categoryComparison;
        
        // 4. Сортировка по остальным полям для задач внутри одной категории или без категории
        const aStatus = Array.isArray(a.status) ? a.status : [String(a.status)];
        const bStatus = Array.isArray(b.status) ? b.status : [String(b.status)];

        function getComparableString(field, isLink = false) {
            if (!field) return "";
            const arr = Array.isArray(field) ? field : [field];
            const items = isLink
                ? arr.map(l => (typeof l === 'string' ? l : l.path))
                : arr.map(String);
            return items.sort().join('|');
        }

        return (
            getComparableString(a.Area).localeCompare(getComparableString(b.Area)) ||
            getComparableString(a.wikilinks, true).localeCompare(getComparableString(b.wikilinks, true)) ||
            a.file.name.localeCompare(b.file.name)
        );
    },
};