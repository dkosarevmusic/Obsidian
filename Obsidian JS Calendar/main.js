/**
 * @file main.js
 * Основная точка входа для рендеринга календаря.
*/

/**
 * Основная функция для отрисовки календаря.
 * @param {object} dv - Глобальный объект API Dataview.
 * @param {luxon.DateTime} viewDate - Дата для отображения (по умолчанию сегодня).
 * @param {string} viewType - Тип вида ('month', '3months', 'year').
 */
OJSC.renderCalendar = (dv, viewDate, viewType) => {
    const previousViewTypeFromStorage = OJSC.state.load().viewType;

    if (viewType === undefined || viewType === null) {
        ({ viewType, viewDate } = OJSC.state.load());
    }

    const didViewTypeChange = previousViewTypeFromStorage !== viewType;
    OJSC.state.save(viewType, viewDate);

    const container = dv.container;
    container.innerHTML = '';

    const tasks = OJSC.services.data.getTasks(dv);
    const tasksByDate = OJSC.services.data.groupTasksByDate(tasks);

    const rootEl = document.createElement('div');
    rootEl.className = 'ojsc-container';

    const styleEl = document.createElement('style');
    rootEl.appendChild(styleEl);

    // Асинхронно загружаем и применяем стили.
    // Это правильный способ работы с асинхронной функцией dv.io.load().
    (async () => {
        try {
            const cssContent = await dv.io.load('JS Scripts/cal/calendar.css');
            styleEl.textContent = cssContent;
        } catch (e) { console.error("OJSC: Не удалось загрузить calendar.css", e); }
    })();

    const headerEl = OJSC.ui.createHeader(dv, viewDate, viewType);
    rootEl.appendChild(headerEl);

    const bodyFragment = document.createDocumentFragment();

    const onTaskDrop = (filePath, newDate, taskToMove, oldDateKey) => {
        if (!filePath || !newDate || !taskToMove) return;

        if (tasksByDate[oldDateKey]) {
            tasksByDate[oldDateKey] = tasksByDate[oldDateKey].filter(t => t.file.path !== filePath);
        }
        if (!tasksByDate[newDate]) {
            tasksByDate[newDate] = [];
        }
        tasksByDate[newDate].push(taskToMove);

        OJSC.services.file.updateTaskDate(dv, filePath, newDate);
    };

    if (viewType === '1day') {
        bodyFragment.appendChild(OJSC.ui.createDayCard(viewDate, tasksByDate, viewType, dv, onTaskDrop));
    } else if (viewType === 'month') {
        bodyFragment.appendChild(OJSC.ui.createMonthGrid(viewDate, tasksByDate, viewType, dv, onTaskDrop));
    } else if (viewType === '3months') {
        for (let i = 0; i < 3; i++) {
            const monthDate = viewDate.plus({ months: i });
            const monthHeader = document.createElement('h3');
            monthHeader.className = 'ojsc-multi-month-header';
            monthHeader.textContent = monthDate.setLocale('ru').toFormat('LLLL yyyy');
            bodyFragment.append(monthHeader, OJSC.ui.createMonthGrid(monthDate, tasksByDate, viewType, dv, onTaskDrop));
        }
    } else if (viewType === 'year') {
        for (let i = 0; i < 12; i++) {
            const monthDate = viewDate.startOf('year').plus({ months: i });
            const monthHeader = document.createElement('h3');
            monthHeader.className = 'ojsc-multi-month-header';
            monthHeader.textContent = monthDate.setLocale('ru').toFormat('LLLL');
            bodyFragment.append(monthHeader, OJSC.ui.createMonthGrid(monthDate, tasksByDate, viewType, dv, onTaskDrop));
        }
    }

    rootEl.appendChild(bodyFragment);
    container.appendChild(rootEl);

    const footer = document.createElement('div');
    footer.className = 'ojsc-footer';
    footer.textContent = 'Calendar by D.KOSAREV';
    container.appendChild(footer);

    if (didViewTypeChange) {
        const scroller = container.closest('.cm-scroller, .markdown-preview-view');
        if (scroller) {
            scroller.scrollTo({ top: 0, behavior: 'auto' });
        }
    }

};