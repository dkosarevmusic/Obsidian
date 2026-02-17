/**
 * @file date-utils.js
 * Вспомогательные функции для работы с датами.
 */
if (!window.OJSC) window.OJSC = {};
if (!OJSC.utils) OJSC.utils = {};

OJSC.utils.date = {
    /**
     * Форматирует объект luxon.DateTime в строку YYYY-MM-DD.
     * @param {luxon.DateTime} luxonDate
     * @returns {string}
     */
    format: (luxonDate) => {
        if (!luxonDate || !luxonDate.isValid) return '';
        return luxonDate.toFormat('yyyy-MM-dd');
    },
};