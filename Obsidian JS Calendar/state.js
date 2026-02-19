/**
 * @file state.js
 * Управляет состоянием календаря, используя localStorage.
 */
if (!window.OJSC) window.OJSC = {};

// Инициализация состояния массовых операций в sessionStorage
// для гарантии сброса при закрытии вкладки/Obsidian.
const initialBulkMode = sessionStorage.getItem('ojsc_bulkMode') === 'true';
const initialSelectedTasks = JSON.parse(sessionStorage.getItem('ojsc_selectedTasks')) || [];

OJSC.state = {
    bulkMode: initialBulkMode,
    selectedTasks: initialSelectedTasks,

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
    },

    getScrollPosition() {
        const pos = sessionStorage.getItem('ojsc_scrollPosition');
        return pos ? parseInt(pos, 10) : null;
    },

    setScrollPosition(position) {
        if (position !== null) {
            sessionStorage.setItem('ojsc_scrollPosition', String(position));
        } else {
            sessionStorage.removeItem('ojsc_scrollPosition');
        }
    },

    setBulkMode(isBulkMode) {
        this.bulkMode = isBulkMode;
        sessionStorage.setItem('ojsc_bulkMode', String(isBulkMode));
        // При выходе из режима массовых операций очищаем список выделенных файлов.
        if (!isBulkMode) {
            this.setSelectedTasks([]);
        }
    },

    setSelectedTasks(tasks) {
        this.selectedTasks = tasks;
        sessionStorage.setItem('ojsc_selectedTasks', JSON.stringify(tasks));
    }
};