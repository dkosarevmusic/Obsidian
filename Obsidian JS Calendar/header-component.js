/**
 * @file header-component.js
 * @description Creates floating UI controls for the calendar, replacing the static header.
 */
if (!window.OJSC) window.OJSC = {};
if (!OJSC.ui) OJSC.ui = {};

/**
 * Creates the secondary, larger floating panel containing all the main calendar controls.
 * This panel is hidden by default.
 * @param {object} dv - Dataview API.
 * @param {luxon.DateTime} viewDate - The current date of the calendar view.
 * @param {string} viewType - The current view type ('1day', 'month', etc.).
 * @param {string} statusMode - The current status mode.
 * @param {boolean} showTime - Visibility state for time.
 * @param {boolean} showParticipants - Visibility state for participants.
 * @param {boolean} showWikilinks - Visibility state for wikilinks.
 * @param {string} categoryFilter - The current category filter.
 * @returns {HTMLElement} The controls panel element.
 */
OJSC.ui.createControlsPanel = (dv, viewDate, viewType, statusMode, showTime, showParticipants, showWikilinks, categoryFilter) => {
    const controlsPanel = document.createElement('div');
    controlsPanel.className = 'ojsc-controls-panel ojsc-floating-panel'; // Hidden by default via CSS
    
    const { title, navStep } = OJSC.ui.getViewParameters(viewDate, viewType);

    // --- Title ---
    const titleEl = document.createElement('h2');
    titleEl.textContent = title;
    controlsPanel.appendChild(titleEl);

    // --- Controls Wrapper ---
    const controlsWrapper = document.createElement('div');
    controlsWrapper.className = 'ojsc-controls-wrapper';

    // --- Navigation Buttons ---
    const createNavButton = (text, onClick) => {
        const button = document.createElement('button');
        button.textContent = text;
        button.onclick = onClick;
        return button;
    };
    
    // Groups
    const mainNavGroup = document.createElement('div');
    mainNavGroup.className = 'ojsc-main-nav-group';

    const modeSelectorsGroup = document.createElement('div');
    modeSelectorsGroup.className = 'ojsc-mode-selectors-group';

    const displayTogglesGroup = document.createElement('div');
    displayTogglesGroup.className = 'ojsc-display-toggles-group';

    // --- View Selector ---
    const viewSelector = document.createElement('select');
    const views = { '1day': '1 день', month: 'Месяц', '3months': '3 месяца', year: 'Год' };
    for (const [value, text] of Object.entries(views)) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = text;
        if (value === viewType) option.selected = true;
        viewSelector.appendChild(option);
    }
    viewSelector.onchange = (e) => {
        const newViewType = e.target.value;
        if (newViewType === '1day' || newViewType === 'overview') OJSC.state.setPreviousView(viewType);
        else OJSC.state.setPreviousView(null);
        OJSC.renderCalendar(dv, viewDate, newViewType, statusMode);
    };

    // --- Status Mode Selector ---
    const statusModeSelector = document.createElement('select');
    const modes = OJSC.config.statusModes;
    for (const [value, config] of Object.entries(modes)) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = config.name;
        if (value === statusMode) option.selected = true;
        statusModeSelector.appendChild(option);
    }
    statusModeSelector.onchange = (e) => OJSC.renderCalendar(dv, viewDate, viewType, e.target.value);
    
    // --- Category Filter Selector ---
    const categoryFilterSelector = document.createElement('select');
    const categories = { 'all': 'Все категории', 'now': 'Now', 'later': 'Later', 'probably': 'Probably', 'dont': 'Dont' };
    for (const [value, text] of Object.entries(categories)) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = text;
        if (value === categoryFilter) option.selected = true;
        categoryFilterSelector.appendChild(option);
    }
    categoryFilterSelector.onchange = (e) => {
        OJSC.state.setCategoryFilter(e.target.value);
        OJSC.renderCalendar(dv, viewDate, viewType, statusMode);
    };

    // --- Toggles ---
    const timeToggleButton = document.createElement('button');
    timeToggleButton.textContent = 'Время';
    if (showTime) timeToggleButton.classList.add('ojsc-button-active');
    timeToggleButton.onclick = () => {
        OJSC.state.setShowTime(!showTime);
        OJSC.renderCalendar(dv, viewDate, viewType, statusMode);
    };

    const participantsToggleButton = document.createElement('button');
    participantsToggleButton.textContent = 'Участники';
    if (showParticipants) participantsToggleButton.classList.add('ojsc-button-active');
    participantsToggleButton.onclick = () => {
        OJSC.state.setShowParticipants(!showParticipants);
        OJSC.renderCalendar(dv, viewDate, viewType, statusMode);
    };

    const wikilinksToggleButton = document.createElement('button');
    wikilinksToggleButton.textContent = 'Проект';
    if (showWikilinks) wikilinksToggleButton.classList.add('ojsc-button-active');
    wikilinksToggleButton.onclick = () => {
        OJSC.state.setShowWikilinks(!showWikilinks);
        OJSC.renderCalendar(dv, viewDate, viewType, statusMode);
    };

    // Populate groups
    mainNavGroup.append(
        createNavButton('<', () => OJSC.renderCalendar(dv, viewDate.minus(navStep), viewType, statusMode, { scrollToTop: true })), 
        createNavButton('>', () => OJSC.renderCalendar(dv, viewDate.plus(navStep), viewType, statusMode, { scrollToTop: true }))
    );
    mainNavGroup.appendChild(viewSelector);
    
    // Back button logic is now handled separately as a floating button.

    modeSelectorsGroup.appendChild(statusModeSelector);
    modeSelectorsGroup.appendChild(categoryFilterSelector);

    displayTogglesGroup.appendChild(timeToggleButton);
    displayTogglesGroup.appendChild(participantsToggleButton);
    displayTogglesGroup.appendChild(wikilinksToggleButton);

    controlsWrapper.appendChild(mainNavGroup);
    controlsWrapper.appendChild(modeSelectorsGroup);
    controlsWrapper.appendChild(displayTogglesGroup);
    
    controlsPanel.appendChild(controlsWrapper);
    return controlsPanel;
};

/**
 * Creates the primary floating action button and the individual menu buttons.
 * @param {object} dv - Dataview API.
 * @param {string} viewType - The current view type.
 * @param {string} statusMode - The current status mode.
 * @returns {DocumentFragment} A fragment containing the new button and menu elements.
 */
OJSC.ui.createFloatingActionButtons = (dv, viewType, statusMode) => {
    const fragment = document.createDocumentFragment();

    // Main Action Button
    const mainActionButton = document.createElement('button');
    mainActionButton.className = 'ojsc-main-action-btn';
    mainActionButton.innerHTML = '☰'; // Hamburger icon
    mainActionButton.title = 'Открыть меню управления';
    fragment.appendChild(mainActionButton);

    // Individual, floating menu buttons (hidden by default)
    
    // --- View Mode Buttons ---
    
    // 1. Overview Button
    const overviewButton = document.createElement('button');
    overviewButton.className = 'ojsc-overview-btn ojsc-floating-menu-btn ojsc-menu-group-up';
    overviewButton.title = 'Today View';
    overviewButton.innerHTML = '🗒️'; // Spiral notepad for overview
    overviewButton.onclick = () => OJSC.renderCalendar(dv, luxon.DateTime.now(), 'overview', statusMode);
    if (viewType === 'overview') {
        overviewButton.classList.add('active');
    }

    // 2. Calendar Button
    const calendarButton = document.createElement('button');
    calendarButton.className = 'ojsc-calendar-btn ojsc-floating-menu-btn ojsc-menu-group-up';
    calendarButton.title = 'Календарь';
    calendarButton.innerHTML = '📅'; // Calendar icon
    calendarButton.onclick = () => OJSC.renderCalendar(dv, luxon.DateTime.now(), '3months', statusMode, { scrollToToday: true });
    // Highlight if it's any of the calendar views
    if (['1day', 'month', '3months', 'year'].includes(viewType)) {
        calendarButton.classList.add('active');
    }

    // 3. Today Button
    const todayButton = document.createElement('button');
    todayButton.className = 'ojsc-today-btn ojsc-floating-menu-btn ojsc-menu-group-right';
    todayButton.title = 'Сегодня';
    todayButton.innerHTML = '🎯'; 
    todayButton.onclick = () => OJSC.renderCalendar(dv, luxon.DateTime.now(), viewType, statusMode, { scrollToToday: true });
    
    // 4. Controls Toggle Button
    const controlsToggleButton = document.createElement('button');
    controlsToggleButton.className = 'ojsc-controls-toggle-btn ojsc-floating-menu-btn ojsc-menu-group-right';
    controlsToggleButton.title = 'Показать/скрыть элементы управления';
    controlsToggleButton.innerHTML = '⚙️';

    // 5. Bulk Operations Button
    const bulkOpsButton = document.createElement('button');
    bulkOpsButton.className = 'ojsc-bulk-mode-btn-menu ojsc-floating-menu-btn ojsc-menu-group-right';
    bulkOpsButton.title = 'Режим массовых операций';
    bulkOpsButton.innerHTML = '📋';

    fragment.appendChild(overviewButton);
    fragment.appendChild(calendarButton);
    fragment.appendChild(todayButton);
    fragment.appendChild(controlsToggleButton);
    fragment.appendChild(bulkOpsButton);
    
    return fragment;
};


OJSC.ui.getViewParameters = (viewDate, viewType) => {
    const ruDate = viewDate.setLocale('ru');

    const viewConfigs = {
        '1day': {
            title: ruDate.toFormat('d MMMM yyyy'),
            navStep: { days: 1 }
        },
        'month': {
            title: ruDate.toFormat('LLLL yyyy'),
            navStep: { months: 1 }
        },
        '3months': {
            title: `${ruDate.toFormat('LLL yyyy')} - ${ruDate.plus({ months: 2 }).toFormat('LLL yyyy')}`,
            navStep: { months: 1 }
        },
        'year': {
            title: ruDate.toFormat('yyyy'),
            navStep: { years: 1 }
        }
    };

    return viewConfigs[viewType] || { title: '', navStep: {} };
};

/**
 * Creates a floating "Back" button if conditions are met (i.e., in 1-day view with a previous view state).
 * @param {object} dv - Dataview API.
 * @param {string} viewType - The current view type.
 * @param {string} statusMode - The current status mode.
 * @returns {HTMLElement|null} The button element or null.
 */
OJSC.ui.createBackButton = (dv, viewType, statusMode) => {
    const previousView = OJSC.state.getPreviousView();
    if ((viewType === '1day' || viewType === 'overview') && previousView) {
        const backButton = document.createElement('button');
        backButton.className = 'ojsc-back-btn';
        backButton.textContent = 'Назад';
        backButton.onclick = () => {
            OJSC.state.setPreviousView(null);
            const lastState = OJSC.state.load();
            OJSC.renderCalendar(dv, lastState.viewDate, previousView, statusMode);
        };
        return backButton;
    }
    return null;
};/**
 * @file overview-component.js
 * @description Creates the overview view that lists tasks in groups.
 */
if (!window.OJSC) window.OJSC = {};
if (!OJSC.ui) OJSC.ui = {};

/**
 * Creates the entire overview container with all its task groups.
 * @param {object} dv - Dataview API.
 * @param {Array<object>} tasks - All tasks to be processed.
 * @param {object} options - Display options like showTime, showParticipants, etc.
 * @returns {HTMLElement} The overview container element.
 */
OJSC.ui.createOverviewView = (dv, tasks, options) => {
    const overviewContainer = document.createElement('div');
    overviewContainer.className = 'ojsc-overview-container';

    // This is the main header for the whole view, which is no longer styled like a day card header.
    const header = document.createElement('h1');
    header.className = 'ojsc-overview-header';
    header.textContent = 'Today View';
    overviewContainer.appendChild(header);

    // --- Helper function to create a group with day cards ---
    const createGroupWithDayCards = (title, taskArray, category) => {
        if (!taskArray || taskArray.length === 0) return null;

        const groupEl = document.createElement('div');
        groupEl.className = 'ojsc-overview-group';

        const groupHeader = document.createElement('h3');
        groupHeader.className = 'ojsc-overview-group-header';
        if (category) {
            groupHeader.classList.add(`ojsc-group-category-${category}`);
        }
        groupHeader.textContent = title;
        groupEl.appendChild(groupHeader);

        const tasksByDate = OJSC.services.data.groupTasksByDate(taskArray);
        // Sort dates chronologically
        const sortedDates = Object.keys(tasksByDate).sort((a, b) => a.localeCompare(b));

        sortedDates.forEach(dateStr => {
            const dayCard = OJSC.ui.createDayCard(
                luxon.DateTime.fromISO(dateStr),
                tasksByDate,
                '1day', // Use '1day' view to get the detailed card style
                dv,
                () => {}, () => {}, // Pass empty functions for drag/drop
                'work', // Assume 'work' status mode for styling context
                options.showTime,
                options.showParticipants,
                options.showWikilinks,
                'all' // No category filter within the card itself
            );
            // Add a margin to each day card within the group for spacing
            dayCard.style.marginBottom = '10px';
            
            // Add border to header, per user request
            const header = dayCard.querySelector('.ojsc-day-card-header');
            if (header) {
                header.classList.add('ojsc-bordered-day-header');
            }
            
            groupEl.appendChild(dayCard);
        });

        return groupEl;
    };

    const today = luxon.DateTime.now().startOf('day');

    // Filter tasks into their respective buckets
    const overdueTasks = tasks.filter(t => luxon.DateTime.fromISO(t[OJSC.config.dateField]) < today);
    const todayTasks = tasks.filter(t => luxon.DateTime.fromISO(t[OJSC.config.dateField]).hasSame(today, 'day'));

    const missedNow = overdueTasks.filter(t => OJSC.utils.task.getTaskCategory(t) === 'now');
    const missedLater = overdueTasks.filter(t => OJSC.utils.task.getTaskCategory(t) === 'later');
    const missedProbably = overdueTasks.filter(t => OJSC.utils.task.getTaskCategory(t) === 'probably');
    const missedDontAndOthers = overdueTasks.filter(t => {
        const category = OJSC.utils.task.getTaskCategory(t);
        return category === 'dont' || category === null;
    });

    // --- Render Groups ---
    const groups = [
        { title: 'Overdue: Now', tasks: missedNow, category: 'now' },
        { title: "Today's Tasks", tasks: todayTasks, category: 'today' },
        { title: 'Overdue: Later', tasks: missedLater, category: 'later' },
        { title: 'Overdue: Probably', tasks: missedProbably, category: 'probably' },
        { title: "Overdue: Don't & Others", tasks: missedDontAndOthers, category: 'dont' }
    ];

    groups.forEach(({ title, tasks, category }) => {
        const groupElement = createGroupWithDayCards(title, tasks, category);
        if (groupElement) {
            overviewContainer.appendChild(groupElement);
        }
    });

    return overviewContainer;
};

