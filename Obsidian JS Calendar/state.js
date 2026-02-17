/**
 * @file state.js
 * Управляет состоянием календаря, используя localStorage.
 */
if (!window.OJSC) window.OJSC = {};

OJSC.state = {
    /**
     * Загружает последнее сохраненное состояние (вид и дата).
     * @returns {{viewType: string, viewDate: luxon.DateTime, statusMode: string}}
     */
    load() {
        const viewType = localStorage.getItem('ojsc_lastViewType') || 'month';
        const savedDate = localStorage.getItem('ojsc_lastViewDate');
        const viewDate = savedDate ? luxon.DateTime.fromISO(savedDate) : luxon.DateTime.now();
        const statusMode = localStorage.getItem('ojsc_lastStatusMode') || 'work'; // По умолчанию 'work'
        return { viewType, viewDate, statusMode };
    },

    /**
     * Сохраняет текущее состояние (вид и дата).
     * @param {string} viewType - Текущий тип вида.
     * @param {luxon.DateTime} viewDate - Текущая дата.
     * @param {string} statusMode - Текущий режим статусов.
     */
    save(viewType, viewDate, statusMode) {
        localStorage.setItem('ojsc_lastViewType', viewType);
        localStorage.setItem('ojsc_lastViewDate', viewDate.toISODate());
        localStorage.setItem('ojsc_lastStatusMode', statusMode);
    },

    getPreviousView() {
        return localStorage.getItem('ojsc_previousView');
    },

    setPreviousView(viewType) {
        if (viewType) localStorage.setItem('ojsc_previousView', viewType);
        else localStorage.removeItem('ojsc_previousView');
    }
};