/**
 * @file main.js
 * Основная точка входа для рендеринга календаря.
*/

/**
 * Основная функция для отрисовки календаря.
 * @param {object} dv - Глобальный объект API Dataview.
 * @param {luxon.DateTime} viewDate - Дата для отображения (по умолчанию сегодня).
 * @param {string} viewType - Тип вида ('1day', 'month', '3months', 'year').
 * @param {string} statusMode - Режим отображения статусов ('work', 'done').
 */
OJSC.renderCalendar = (dv, viewDate, viewType, statusMode, options = {}) => {
    const lastState = OJSC.state.load();
    const { showTime, showParticipants } = lastState;
    const previousViewTypeFromStorage = lastState.viewType;

    if (viewType === undefined || viewType === null || statusMode === undefined || statusMode === null) {
        ({ viewType, viewDate, statusMode } = lastState);
    }

    const didViewTypeChange = previousViewTypeFromStorage !== viewType;
    OJSC.state.save(viewType, viewDate, statusMode);

    const container = dv.container;
    container.innerHTML = '';

    const tasks = OJSC.services.data.getTasks(dv, statusMode);
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

    const headerEl = OJSC.ui.createHeader(dv, viewDate, viewType, statusMode, showTime, showParticipants);
    rootEl.appendChild(headerEl);

    const bodyFragment = document.createDocumentFragment();

    const scroller = container.closest('.cm-scroller, .markdown-preview-view');

    const onTaskDrop = (filePath, newDate, taskToMove, oldDateKey) => {
        if (!filePath || !newDate || !taskToMove) return;

        if (scroller) {
            OJSC.state.setScrollPosition(scroller.scrollTop);
        }

        if (tasksByDate[oldDateKey]) {
            tasksByDate[oldDateKey] = tasksByDate[oldDateKey].filter(t => t.file.path !== filePath);
        }
        if (!tasksByDate[newDate]) {
            tasksByDate[newDate] = [];
        }
        // Добавляем задачу и сразу сортируем список задач в новом дне.
        // Это гарантирует правильный порядок отображения после переноса.
        tasksByDate[newDate].push(taskToMove);
        tasksByDate[newDate].sort(OJSC.utils.task.compare);

        OJSC.services.file.updateTaskDate(dv, filePath, newDate);
    };

    if (viewType === '1day') {
        bodyFragment.appendChild(OJSC.ui.createDayCard(viewDate, tasksByDate, viewType, dv, onTaskDrop, statusMode, showTime, showParticipants));
    } else if (viewType === 'month') {
        bodyFragment.appendChild(OJSC.ui.createMonthGrid(viewDate, tasksByDate, viewType, dv, onTaskDrop, statusMode, showTime, showParticipants));
    } else if (viewType === '3months') {
        const createMonthView = (monthDate) => {
            const monthHeader = document.createElement('h3');
            monthHeader.className = 'ojsc-multi-month-header';
            monthHeader.textContent = monthDate.setLocale('ru').toFormat('LLLL yyyy');
            const monthGrid = OJSC.ui.createMonthGrid(monthDate, tasksByDate, viewType, dv, onTaskDrop, statusMode, showTime, showParticipants);
            return [monthHeader, monthGrid];
        };
        for (let i = 0; i < 3; i++) {
            bodyFragment.append(...createMonthView(viewDate.plus({ months: i })));
        }
    } else if (viewType === 'year') {
        const createMonthView = (monthDate) => {
            const monthHeader = document.createElement('h3');
            monthHeader.className = 'ojsc-multi-month-header';
            monthHeader.textContent = monthDate.setLocale('ru').toFormat('LLLL');
            const monthGrid = OJSC.ui.createMonthGrid(monthDate, tasksByDate, viewType, dv, onTaskDrop, statusMode, showTime, showParticipants);
            return [monthHeader, monthGrid];
        };
        for (let i = 0; i < 12; i++) {
            bodyFragment.append(...createMonthView(viewDate.startOf('year').plus({ months: i })));
        }
    }

    rootEl.appendChild(bodyFragment);
    container.appendChild(rootEl);

    const footer = document.createElement('div');
    footer.className = 'ojsc-footer';
    footer.textContent = 'Calendar by D.KOSAREV';
    container.appendChild(footer);

    // --- Scroll to Top Button ---
    const scrollToTopBtn = document.createElement('button');
    scrollToTopBtn.className = 'ojsc-scroll-to-top';
    scrollToTopBtn.innerHTML = '&#8679;'; // Upwards arrow
    container.appendChild(scrollToTopBtn);

    if (scroller) {
        scroller.addEventListener('scroll', () => {
            if (scroller.scrollTop > 300) {
                scrollToTopBtn.classList.add('visible');
            } else {
                scrollToTopBtn.classList.remove('visible');
            }
        });

        scrollToTopBtn.addEventListener('click', () => {
            scroller.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // --- Smart Scrolling Logic ---
    const savedScroll = OJSC.state.getScrollPosition();
    let scrolled = false;

    if (savedScroll !== null) {
        // Priority 0: A scroll position was saved from a previous action (like DnD)
        if (scroller) {
            scroller.scrollTo({ top: savedScroll, behavior: 'auto' });
        }
        OJSC.state.setScrollPosition(null); // Clear the saved position
        scrolled = true;
    }
    else if (['month', '3months', 'year'].includes(viewType)) {
        let cardToScrollTo = null;

        if (didViewTypeChange && previousViewTypeFromStorage === '1day') {
            // Priority 1: Returning from 1-day view, scroll to the day we came from.
            const dateToScrollTo = viewDate.toISODate();
            cardToScrollTo = rootEl.querySelector(`[data-date="${dateToScrollTo}"]`);
        } else if (options.scrollToToday) {
            // Priority 2: "Today" button was clicked.
            cardToScrollTo = rootEl.querySelector('.ojsc-today');
        }
        
        if (cardToScrollTo) {
            setTimeout(() => {
                cardToScrollTo.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'center' });
            }, 150); // Delay for rendering.
            scrolled = true;
        }
    }

    // Default scroll to top if no other scroll was performed.
    // This handles initial load and view type changes (e.g., month to year).
    if (!scrolled) {
        if (scroller) {
            scroller.scrollTo({ top: 0, behavior: 'auto' });
        }
    }
};