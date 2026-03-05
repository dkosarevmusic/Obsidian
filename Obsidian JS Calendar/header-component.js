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
        if (newViewType === '1day') OJSC.state.setPreviousView(viewType);
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
        createNavButton('<', () => OJSC.renderCalendar(dv, viewDate.minus(navStep), viewType, statusMode)), 
        createNavButton('>', () => OJSC.renderCalendar(dv, viewDate.plus(navStep), viewType, statusMode))
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
    
    // 1. Today Button
    const todayButton = document.createElement('button');
    todayButton.className = 'ojsc-today-btn ojsc-floating-menu-btn';
    todayButton.title = 'Сегодня';
    todayButton.innerHTML = '🎯'; 
    todayButton.onclick = () => OJSC.renderCalendar(dv, luxon.DateTime.now(), viewType, statusMode, { scrollToToday: true });
    
    // 2. Controls Toggle Button
    const controlsToggleButton = document.createElement('button');
    controlsToggleButton.className = 'ojsc-controls-toggle-btn ojsc-floating-menu-btn';
    controlsToggleButton.title = 'Показать/скрыть элементы управления';
    controlsToggleButton.innerHTML = '🔩';

    // 3. Bulk Operations Button
    const bulkOpsButton = document.createElement('button');
    bulkOpsButton.className = 'ojsc-bulk-mode-btn-menu ojsc-floating-menu-btn';
    bulkOpsButton.title = 'Режим массовых операций';
    bulkOpsButton.innerHTML = '📋';

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
    if (viewType === '1day' && previousView) {
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
};