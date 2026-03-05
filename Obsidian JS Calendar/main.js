/**
 * @file main.js
 * Основная точка входа для рендеринга календаря.
*/

OJSC.renderCalendar = (dv, viewDate, viewType, statusMode, options = {}) => {
    // Distinguish between a fresh file opening and a Dataview auto-refresh.
    // If the container already has content, it's likely an auto-refresh.
    const isAutoRefresh = dv.container.hasChildNodes();
    
    if (viewDate === undefined) { // Called without arguments, i.e., initial load
        const lastState = OJSC.state.load(); // Load last used viewType/statusMode
        if (isAutoRefresh) {
            // This is an auto-refresh, so preserve the last viewed date.
            viewDate = lastState.viewDate;
            viewType = lastState.viewType;
            statusMode = lastState.statusMode;
        } else {
            // This is a new file opening, so reset to "Today".
            viewDate = luxon.DateTime.now();
            viewType = lastState.viewType;
            statusMode = lastState.statusMode;
            options.scrollToToday = true;
        }
    }

    // --- One-time setup for cache invalidation ---
    if (!window.OJSC._cacheInvalidatorRegistered) {
        dv.app.vault.on('modify', () => OJSC.services.data.clearCache());
        window.OJSC._cacheInvalidatorRegistered = true;
    }
    
    const lastState = OJSC.state.load();
    const { showTime, showParticipants, showWikilinks, categoryFilter } = lastState;
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
    rootEl.classList.add(`ojsc-status-mode-${statusMode}`);
    if (!showWikilinks) {
        rootEl.classList.add('ojsc-hide-wikilinks');
    }

    // --- CSS Loading ---
    const applyCss = (css) => {
        const styleEl = document.createElement('style');
        styleEl.textContent = css;
        rootEl.prepend(styleEl);
    };

    if (window.OJSC_CSS_CONTENT) {
        applyCss(window.OJSC_CSS_CONTENT);
    } else {
        dv.io.load('JS Scripts/cal/calendar.css').then(css => {
            window.OJSC_CSS_CONTENT = css;
            applyCss(css);
        }).catch(e => console.error("OJSC: Failed to load calendar.css. Ensure it is at 'JS Scripts/cal/calendar.css'", e));
    }

    // Static header is no longer created here.

    const bodyFragment = document.createDocumentFragment();
    const scroller = container.closest('.cm-scroller, .markdown-preview-view');

    const onTaskDrop = (filePath, newDate, taskToMove, oldDateKey) => {
        if (!filePath || !newDate || !taskToMove) return;
        if (scroller) OJSC.state.setScrollPosition(scroller.scrollTop);

        if (tasksByDate[oldDateKey]) {
            tasksByDate[oldDateKey] = tasksByDate[oldDateKey].filter(t => t.file.path !== filePath);
        }
        if (!tasksByDate[newDate]) tasksByDate[newDate] = [];
        
        tasksByDate[newDate].push(taskToMove);
        tasksByDate[newDate].sort(OJSC.utils.task.compare);

        OJSC.services.file.updateTaskDate(dv, filePath, newDate);
    };

    const onBulkTaskDrop = (tasksToMove, newDate) => {
        tasksToMove.forEach(task => {
            const oldDateStr = task[OJSC.config.dateField];
            if (!oldDateStr) return;
            const oldDateKey = luxon.DateTime.fromISO(oldDateStr).toISODate();
            if (tasksByDate[oldDateKey]) {
                tasksByDate[oldDateKey] = tasksByDate[oldDateKey].filter(t => t.file.path !== task.file.path);
            }
            if (!tasksByDate[newDate]) tasksByDate[newDate] = [];
            tasksByDate[newDate].push(task);
        });

        if (tasksByDate[newDate]) tasksByDate[newDate].sort(OJSC.utils.task.compare);
        tasksToMove.forEach(task => OJSC.services.file.updateTaskDate(dv, task.file.path, newDate));
    };

    // --- RENDER BODY ---
    if (viewType === '1day') {
        bodyFragment.appendChild(OJSC.ui.createDayCard(viewDate, tasksByDate, viewType, dv, onTaskDrop, onBulkTaskDrop, statusMode, showTime, showParticipants, showWikilinks, categoryFilter));
    } else if (viewType === 'month') {
        bodyFragment.appendChild(OJSC.ui.createMonthGrid(viewDate, tasksByDate, viewType, dv, onTaskDrop, onBulkTaskDrop, statusMode, showTime, showParticipants, showWikilinks, categoryFilter));
    } else if (viewType === '3months' || viewType === 'year') {
        const monthsCount = viewType === '3months' ? 3 : 12;
        const start = viewType === 'year' ? viewDate.startOf('year') : viewDate;
        for (let i = 0; i < monthsCount; i++) {
            const monthDate = start.plus({ months: i });
            const monthHeader = document.createElement('h3');
            monthHeader.className = 'ojsc-multi-month-header';
            monthHeader.textContent = monthDate.setLocale('ru').toFormat(viewType === 'year' ? 'LLLL' : 'LLLL yyyy');
            const monthGrid = OJSC.ui.createMonthGrid(monthDate, tasksByDate, viewType, dv, onTaskDrop, onBulkTaskDrop, statusMode, showTime, showParticipants, showWikilinks, categoryFilter);
            bodyFragment.append(monthHeader, monthGrid);
        }
    }

    rootEl.appendChild(bodyFragment);
    container.appendChild(rootEl);

    const footer = document.createElement('div');
    footer.className = 'ojsc-footer';
    footer.textContent = 'Calendar by D.KOSAREV';
    container.appendChild(footer);

    // --- FLOATING UI and BULK OPERATIONS ---
    
    // --- Create and append new floating UI elements ---
    const controlsPanel = OJSC.ui.createControlsPanel(dv, viewDate, viewType, statusMode, showTime, showParticipants, showWikilinks, categoryFilter);
    container.appendChild(controlsPanel);

    const floatingButtonsFragment = OJSC.ui.createFloatingActionButtons(dv, viewType, statusMode);
    container.appendChild(floatingButtonsFragment);

    const backButton = OJSC.ui.createBackButton(dv, viewType, statusMode);
    if (backButton) {
        container.appendChild(backButton);
    }

    // --- Get references to new elements ---
    const mainActionBtn = container.querySelector('.ojsc-main-action-btn');
    const todayBtn = container.querySelector('.ojsc-today-btn');
    const controlsToggleBtn = container.querySelector('.ojsc-controls-toggle-btn');
    const bulkModeMenuBtn = container.querySelector('.ojsc-bulk-mode-btn-menu');
    
    // Create a container for the status buttons to manage layout
    const bulkActionsContainer = document.createElement('div');
    bulkActionsContainer.className = 'ojsc-bulk-actions-container';
    container.appendChild(bulkActionsContainer);

    // --- Status Setting Buttons ---
    const bulkSetInProgressBtn = document.createElement('button');
    bulkSetInProgressBtn.className = 'ojsc-bulk-set-in-progress-btn';
    bulkSetInProgressBtn.innerHTML = "<svg viewBox='0 0 10 10' width='36' height='36'><path d='M 2 2 L 8 5 L 2 8 Z' fill='currentColor'/></svg>";
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

    // Contextual Button Visibility
    if (statusMode === 'work') { bulkSetInProgressBtn.style.display = 'none'; }
    if (statusMode === 'done') { bulkSetDoneBtn.style.display = 'none'; }
    if (statusMode === 'cancelled') { bulkSetCancelBtn.style.display = 'none'; }
    if (statusMode === 'postpone') { bulkSetPostponeBtn.style.display = 'none'; }


    const setBulkModeUI = (isBulkMode) => {
        rootEl.classList.toggle('ojsc-bulk-mode', isBulkMode);
        // Target the new button in the menu
        container.querySelector('.ojsc-bulk-mode-btn-menu')?.classList.toggle('active', isBulkMode);
        [bulkSetInProgressBtn, bulkSetDoneBtn, bulkSetCancelBtn, bulkSetPostponeBtn].forEach(btn => {
            btn.classList.toggle('visible', isBulkMode);
        });
    };

    const toggleBulkMode = () => {
        const isBulkMode = !OJSC.state.bulkMode;
        if (!isBulkMode) {
            if (scroller) OJSC.state.setScrollPosition(scroller.scrollTop);
        }
        OJSC.state.setBulkMode(isBulkMode);
        setBulkModeUI(isBulkMode);

        if (!isBulkMode) OJSC.renderCalendar(dv, viewDate, viewType, statusMode);
    };

    const createStatusUpdateHandler = (tasks, targetStatus) => () => {
        if (tasks.length === 0) {
            new Notice(`Нет выбранных задач для установки статуса "${targetStatus}".`, 2000);
            return;
        }
        if (scroller) OJSC.state.setScrollPosition(scroller.scrollTop);
        sessionStorage.setItem('ojsc_postRenderCommand', 'exitBulkMode');
        
        container.querySelectorAll('.ojsc-task-item-selected')
                 .forEach(el => el.classList.add('ojsc-task-item-updating'));

        tasks.forEach(task => OJSC.services.file.setTaskStatus(dv, task.file.path, targetStatus));
        new Notice(`Обновление статуса для ${tasks.length} задач запущено...`);
    };
    
    // Add event listeners for status buttons
    bulkSetInProgressBtn.addEventListener('click', createStatusUpdateHandler(OJSC.state.selectedTasks, 'in progress'));
    bulkSetDoneBtn.addEventListener('click', createStatusUpdateHandler(OJSC.state.selectedTasks, 'done'));
    bulkSetCancelBtn.addEventListener('click', createStatusUpdateHandler(OJSC.state.selectedTasks, 'cancelled'));
    bulkSetPostponeBtn.addEventListener('click', createStatusUpdateHandler(OJSC.state.selectedTasks, 'postpone'));

    // --- Floating UI Interaction Logic ---
    const menuButtons = [todayBtn, controlsToggleBtn, bulkModeMenuBtn];

    if(mainActionBtn) {
        mainActionBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isVisible = todayBtn.classList.contains('visible');
            if (!isVisible) {
                controlsPanel.classList.remove('visible');
            }
            menuButtons.forEach(btn => btn.classList.toggle('visible'));
        });
    }

    if(controlsToggleBtn) {
        controlsToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            // Hide other menu buttons when opening the controls panel
            menuButtons.forEach(btn => btn.classList.remove('visible'));
            controlsPanel.classList.toggle('visible');
        });
    }

    // Re-wire bulk mode logic to the new button
    if(bulkModeMenuBtn) {
        bulkModeMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleBulkMode();
            // Hide menu buttons after activating
            menuButtons.forEach(btn => btn.classList.remove('visible'));
        });
    }

    // Close menus when clicking on an empty area of the calendar
    rootEl.addEventListener('click', (e) => {
        // The click handlers on the buttons use e.stopPropagation(),
        // so this event will only be triggered by clicks on the calendar's
        // background or other non-interactive elements within the container.
        // Therefore, any click that reaches here should close the menus.
        menuButtons.forEach(btn => btn?.classList.remove('visible'));
        controlsPanel?.classList.remove('visible');
    });

    // Set initial state from memory
    if (OJSC.state.bulkMode) {
        setBulkModeUI(true);
    }

    // --- Scroll to Top Button ---
    const scrollToTopBtn = document.createElement('button');
    scrollToTopBtn.className = 'ojsc-scroll-to-top';
    scrollToTopBtn.innerHTML = '&#9650;';
    scrollToTopBtn.title = 'Наверх';
    container.appendChild(scrollToTopBtn);

    if (scroller) {
        scroller.addEventListener('scroll', () => {
            scrollToTopBtn.classList.toggle('visible', scroller.scrollTop > 300);
        });
        scrollToTopBtn.addEventListener('click', () => {
            container.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }

    // --- Smart Scrolling Logic ---
    const savedScroll = OJSC.state.getScrollPosition();
    if (savedScroll !== null) {
        if (scroller) scroller.scrollTo({ top: savedScroll, behavior: 'auto' });
        OJSC.state.setScrollPosition(null);
    } else if (options.scrollToTop) {
        if (scroller) scroller.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (['month', '3months', 'year'].includes(viewType)) {
        let cardToScrollTo = null;
        if (didViewTypeChange && previousViewTypeFromStorage === '1day') {
            cardToScrollTo = rootEl.querySelector(`[data-date="${viewDate.toISODate()}"]`);
        } else if (options.scrollToToday) {
            cardToScrollTo = rootEl.querySelector('.ojsc-today');
        }
        if (cardToScrollTo) {
            setTimeout(() => cardToScrollTo.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'center' }), 300);
        }
    } else {
        if (scroller) scroller.scrollTo({ top: 0, behavior: 'auto' });
    }

    // --- Post-Render Commands ---
    const command = sessionStorage.getItem('ojsc_postRenderCommand');
    if (command === 'exitBulkMode') {
        sessionStorage.removeItem('ojsc_postRenderCommand');
        if (OJSC.state.bulkMode) {
            OJSC.state.setBulkMode(false);
            setBulkModeUI(false);
        }
    }
};