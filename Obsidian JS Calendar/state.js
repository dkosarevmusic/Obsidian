/**
 * @file state.js
 * Управляет состоянием календаря, используя localStorage.
 */
if (!window.OJSC) window.OJSC = {};

OJSC.state = {
    /**
     * Загружает последнее сохраненное состояние (вид и дата).
     * @returns {{viewType: string, viewDate: luxon.DateTime, statusMode: string, showTime: boolean, showParticipants: boolean}}
     */
    load() {
        const viewType = localStorage.getItem('ojsc_lastViewType') || 'month';
        const savedDate = localStorage.getItem('ojsc_lastViewDate');
        const viewDate = savedDate ? luxon.DateTime.fromISO(savedDate) : luxon.DateTime.now();
        const statusMode = localStorage.getItem('ojsc_lastStatusMode') || 'work';
        const showTime = this.getShowTime();
        const showParticipants = this.getShowParticipants();
        return { viewType, viewDate, statusMode, showTime, showParticipants };
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

    getShowTime() {
        return localStorage.getItem('ojsc_showTime') === 'true';
    },

    setShowTime(showTime) {
        localStorage.setItem('ojsc_showTime', String(showTime));
    },

    getShowParticipants() {
        return localStorage.getItem('ojsc_showParticipants') === 'true';
    },

    setShowParticipants(showParticipants) {
        localStorage.setItem('ojsc_showParticipants', String(showParticipants));
    },

    getPreviousView() {
        return localStorage.getItem('ojsc_previousView');
    },

    setPreviousView(viewType) {
        if (viewType) localStorage.setItem('ojsc_previousView', viewType);
        else localStorage.removeItem('ojsc_previousView');
    }
};