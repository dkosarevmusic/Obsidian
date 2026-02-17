/**
 * @file state.js
 * Управляет состоянием календаря, используя localStorage.
 */
if (!window.OJSC) window.OJSC = {};

OJSC.state = {
    /**
     * Загружает последнее сохраненное состояние (вид и дата).
     * @returns {{viewType: string, viewDate: luxon.DateTime}}
     */
    load() {
        const viewType = localStorage.getItem('ojsc_lastViewType') || 'month';
        const savedDate = localStorage.getItem('ojsc_lastViewDate');
        const viewDate = savedDate ? luxon.DateTime.fromISO(savedDate) : luxon.DateTime.now();
        return { viewType, viewDate };
    },

    /**
     * Сохраняет текущее состояние (вид и дата).
     * @param {string} viewType - Текущий тип вида.
     * @param {luxon.DateTime} viewDate - Текущая дата.
     */
    save(viewType, viewDate) {
        localStorage.setItem('ojsc_lastViewType', viewType);
        localStorage.setItem('ojsc_lastViewDate', viewDate.toISODate());
    },

    getPreviousView() {
        return localStorage.getItem('ojsc_previousView');
    },

    setPreviousView(viewType) {
        if (viewType) localStorage.setItem('ojsc_previousView', viewType);
        else localStorage.removeItem('ojsc_previousView');
    }
};