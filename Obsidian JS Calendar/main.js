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
    // Добавляем класс для цветовой обводки в зависимости от режима статуса
    rootEl.classList.add(`ojsc-status-mode-${statusMode}`);

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

    const onBulkTaskDrop = (tasksToMove, newDate) => {
        // Optimistic in-memory data update
        tasksToMove.forEach(task => {
            // Attempt to find the old date from the task object if it exists
            const oldDateStr = task[OJSC.config.dateField];
            if (!oldDateStr) return; // Skip if no date field

            const oldDateKey = luxon.DateTime.fromISO(oldDateStr).toISODate();
            
            if (tasksByDate[oldDateKey]) {
                tasksByDate[oldDateKey] = tasksByDate[oldDateKey].filter(t => t.file.path !== task.file.path);
            }
            if (!tasksByDate[newDate]) {
                tasksByDate[newDate] = [];
            }
            tasksByDate[newDate].push(task);
        });

        // Sort the new day's list once after all tasks are added
        if (tasksByDate[newDate]) {
            tasksByDate[newDate].sort(OJSC.utils.task.compare);
        }

        // Fire-and-forget file updates
        tasksToMove.forEach(task => {
            OJSC.services.file.updateTaskDate(dv, task.file.path, newDate);
        });
    };

    if (viewType === '1day') {
        bodyFragment.appendChild(OJSC.ui.createDayCard(viewDate, tasksByDate, viewType, dv, onTaskDrop, onBulkTaskDrop, statusMode, showTime, showParticipants));
    } else if (viewType === 'month') {
        bodyFragment.appendChild(OJSC.ui.createMonthGrid(viewDate, tasksByDate, viewType, dv, onTaskDrop, onBulkTaskDrop, statusMode, showTime, showParticipants));
    } else if (viewType === '3months') {
        const createMonthView = (monthDate) => {
            const monthHeader = document.createElement('h3');
            monthHeader.className = 'ojsc-multi-month-header';
            monthHeader.textContent = monthDate.setLocale('ru').toFormat('LLLL yyyy');
            const monthGrid = OJSC.ui.createMonthGrid(monthDate, tasksByDate, viewType, dv, onTaskDrop, onBulkTaskDrop, statusMode, showTime, showParticipants);
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
            const monthGrid = OJSC.ui.createMonthGrid(monthDate, tasksByDate, viewType, dv, onTaskDrop, onBulkTaskDrop, statusMode, showTime, showParticipants);
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

    // --- Bulk Operations UI Elements ---
    const bulkModeBtn = document.createElement('button');
    bulkModeBtn.className = 'ojsc-bulk-mode-btn';
    bulkModeBtn.innerHTML = '&#9745;'; // Softer ballot box icon
    bulkModeBtn.title = 'Режим массовых операций';
    container.appendChild(bulkModeBtn);

    // Create a container for the status buttons to manage layout
    const bulkActionsContainer = document.createElement('div');
    bulkActionsContainer.className = 'ojsc-bulk-actions-container';
    container.appendChild(bulkActionsContainer);

    // --- Status Setting Buttons ---
    const bulkSetInProgressBtn = document.createElement('button');
    bulkSetInProgressBtn.className = 'ojsc-bulk-set-in-progress-btn';
    bulkSetInProgressBtn.innerHTML = '▶️';
    bulkSetInProgressBtn.title = 'Установить статус "in progress"';
    bulkActionsContainer.appendChild(bulkSetInProgressBtn);

    const bulkSetDoneBtn = document.createElement('button');
    bulkSetDoneBtn.className = 'ojsc-bulk-set-done-btn';
    bulkSetDoneBtn.innerHTML = '✅';
    bulkSetDoneBtn.title = 'Установить статус "done"';
    bulkActionsContainer.appendChild(bulkSetDoneBtn);

    const bulkSetCancelBtn = document.createElement('button');
    bulkSetCancelBtn.className = 'ojsc-bulk-set-cancel-btn';
    bulkSetCancelBtn.innerHTML = '❌';
    bulkSetCancelBtn.title = 'Установить статус "cancelled"';
    bulkActionsContainer.appendChild(bulkSetCancelBtn);

    const bulkSetPostponeBtn = document.createElement('button');
    bulkSetPostponeBtn.className = 'ojsc-bulk-set-postpone-btn';
    bulkSetPostponeBtn.innerHTML = '⏸️';
    bulkSetPostponeBtn.title = 'Установить статус "postpone"';
    bulkActionsContainer.appendChild(bulkSetPostponeBtn);

    // --- Contextual Button Visibility ---
    // Hide buttons for the current status mode, as it's redundant
    if (statusMode === 'work') { bulkSetInProgressBtn.style.display = 'none'; }
    if (statusMode === 'done') { bulkSetDoneBtn.style.display = 'none'; }
    if (statusMode === 'cancelled') { bulkSetCancelBtn.style.display = 'none'; }
    if (statusMode === 'postpone') { bulkSetPostponeBtn.style.display = 'none'; }


    const setBulkModeUI = (isBulkMode) => {
        rootEl.classList.toggle('ojsc-bulk-mode', isBulkMode);
        bulkModeBtn.classList.toggle('active', isBulkMode);
        [bulkSetInProgressBtn, bulkSetDoneBtn, bulkSetCancelBtn, bulkSetPostponeBtn].forEach(btn => {
            btn.classList.toggle('visible', isBulkMode);
        });
    };

    // Function to toggle bulk mode UI and state
    const toggleBulkMode = () => {
        const isBulkMode = !OJSC.state.bulkMode;
        if (!isBulkMode) {
            const scroller = container.closest('.cm-scroller, .markdown-preview-view');
            if (scroller) OJSC.state.setScrollPosition(scroller.scrollTop);
        }
        OJSC.state.setBulkMode(isBulkMode);
        setBulkModeUI(isBulkMode);

        if (!isBulkMode) OJSC.renderCalendar(dv, viewDate, viewType, statusMode);
    };

    // Generic helper for status button click events
    const createStatusUpdateHandler = (tasks, targetStatus) => () => {
        if (tasks.length === 0) {
            new Notice(`Нет выбранных задач для установки статуса "${targetStatus}".`, 2000);
            return;
        }

        // 1. Save scroll position and post-render command
        const scroller = container.closest('.cm-scroller, .markdown-preview-view');
        if (scroller) OJSC.state.setScrollPosition(scroller.scrollTop);
        sessionStorage.setItem('ojsc_postRenderCommand', 'exitBulkMode');
        
        // 2. Add flashing effect to selected items
        const selectedElements = container.querySelectorAll('.ojsc-task-item-selected');
        selectedElements.forEach(el => el.classList.add('ojsc-task-item-updating'));

        // 3. Fire-and-forget file updates.
        // Dataview's file watcher will detect the changes and trigger a re-render of the script.
        tasks.forEach(task => {
            OJSC.services.file.setTaskStatus(dv, task.file.path, targetStatus);
        });

        // 4. Give user immediate feedback
        new Notice(`Обновление статуса для ${tasks.length} задач запущено...`);
    };
    
    // Add event listeners
    bulkSetInProgressBtn.addEventListener('click', createStatusUpdateHandler(OJSC.state.selectedTasks, 'in progress'));
    bulkSetDoneBtn.addEventListener('click', createStatusUpdateHandler(OJSC.state.selectedTasks, 'done'));
    bulkSetCancelBtn.addEventListener('click', createStatusUpdateHandler(OJSC.state.selectedTasks, 'cancelled'));
    bulkSetPostponeBtn.addEventListener('click', createStatusUpdateHandler(OJSC.state.selectedTasks, 'postpone'));


    // Set initial state from memory
    if (OJSC.state.bulkMode) {
        setBulkModeUI(true);
    }

    bulkModeBtn.addEventListener('click', toggleBulkMode);


    // --- Scroll to Top Button ---
    const scrollToTopBtn = document.createElement('button');
    scrollToTopBtn.className = 'ojsc-scroll-to-top';
    scrollToTopBtn.innerHTML = '&#9650;'; // Softer upwards arrow
    scrollToTopBtn.title = 'Наверх';
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
            container.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }

    // --- Smart Scrolling Logic ---
    const savedScroll = OJSC.state.getScrollPosition();
    let scrolled = false;

    if (savedScroll !== null) {
        // Priority 0: A scroll position was saved from a previous action.
        if (scroller) {
            scroller.scrollTo({ top: savedScroll, behavior: 'auto' });
        }
        // ALWAYS clear the scroll position after using it to prevent unintended jumps.
        OJSC.state.setScrollPosition(null);
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

    // --- Post-Render Commands ---
    // Execute commands after the main render is complete.
    const command = sessionStorage.getItem('ojsc_postRenderCommand');
    if (command === 'exitBulkMode') {
        sessionStorage.removeItem('ojsc_postRenderCommand');
        if (OJSC.state.bulkMode) {
            OJSC.state.setBulkMode(false);
            setBulkModeUI(false);
        }
    }
};