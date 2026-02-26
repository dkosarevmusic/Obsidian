/**
 * @file header-component.js
 * Компонент для создания шапки календаря с навигацией.
 */
if (!window.OJSC) window.OJSC = {};
if (!OJSC.ui) OJSC.ui = {};

OJSC.ui.createHeader = (dv, viewDate, viewType, statusMode, showTime, showParticipants, showWikilinks) => {
    const headerEl = document.createElement('div');
    headerEl.className = 'ojsc-calendar-header';

    const viewControlsGroup = document.createElement('div');
    viewControlsGroup.className = 'ojsc-view-controls-group';

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
        if (newViewType === '1day') {
            OJSC.state.setPreviousView(viewType);
        } else {
            OJSC.state.setPreviousView(null);
        }
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
    statusModeSelector.onchange = (e) => {
        const newStatusMode = e.target.value;
        // Перерисовываем календарь с новым режимом статусов,
        // сохраняя текущую дату и вид.
        OJSC.renderCalendar(dv, viewDate, viewType, newStatusMode);
    };

    // --- Time Toggle Button ---
    const timeToggleButton = document.createElement('button');
    timeToggleButton.textContent = 'Время';
    if (showTime) {
        timeToggleButton.classList.add('ojsc-button-active');
    }
    timeToggleButton.onclick = () => {
        const newShowTime = !showTime;
        OJSC.state.setShowTime(newShowTime);
        OJSC.renderCalendar(dv, viewDate, viewType, statusMode);
    };

    // --- Participants Toggle Button ---
    const participantsToggleButton = document.createElement('button');
    participantsToggleButton.textContent = 'Участники';
    if (showParticipants) {
        participantsToggleButton.classList.add('ojsc-button-active');
    }
    participantsToggleButton.onclick = () => {
        const newShowParticipants = !showParticipants;
        OJSC.state.setShowParticipants(newShowParticipants);
        OJSC.renderCalendar(dv, viewDate, viewType, statusMode);
    };

    // --- Wikilinks Toggle Button ---
    const wikilinksToggleButton = document.createElement('button');
    wikilinksToggleButton.textContent = 'Проект';
    if (showWikilinks) {
        wikilinksToggleButton.classList.add('ojsc-button-active');
    }
    wikilinksToggleButton.onclick = () => {
        const newShowWikilinks = !showWikilinks;
        OJSC.state.setShowWikilinks(newShowWikilinks);
        OJSC.renderCalendar(dv, viewDate, viewType, statusMode);
    };


    // --- Navigation Buttons ---
    const createNavButton = (text, onClick) => {
        const button = document.createElement('button');
        button.textContent = text;
        button.onclick = onClick;
        return button;
    };

    // --- Title ---
    const { title, navStep } = OJSC.ui.getViewParameters(viewDate, viewType);
    const titleEl = document.createElement('h2');
    titleEl.textContent = title;
    headerEl.appendChild(titleEl);

    // --- Controls Wrapper ---
    const controlsWrapper = document.createElement('div');
    controlsWrapper.className = 'ojsc-controls-wrapper';

    const mainNavGroup = document.createElement('div');
    mainNavGroup.className = 'ojsc-main-nav-group';

    mainNavGroup.append(createNavButton('<', () => OJSC.renderCalendar(dv, viewDate.minus(navStep), viewType, statusMode)), createNavButton('Сегодня', () => OJSC.renderCalendar(dv, luxon.DateTime.now(), viewType, statusMode, { scrollToToday: true })), createNavButton('>', () => OJSC.renderCalendar(dv, viewDate.plus(navStep), viewType, statusMode)));

    mainNavGroup.appendChild(viewSelector);

    const previousView = OJSC.state.getPreviousView();
    if (viewType === '1day' && previousView) {
        const backButton = document.createElement('button');
        backButton.textContent = 'Назад';
        backButton.onclick = () => {
            OJSC.state.setPreviousView(null);
            const lastState = OJSC.state.load(); // Загружаем последнюю дату для того вида
            OJSC.renderCalendar(dv, lastState.viewDate, previousView, statusMode);
        };
        mainNavGroup.appendChild(backButton);
    }

    controlsWrapper.appendChild(mainNavGroup);
    viewControlsGroup.appendChild(statusModeSelector);
    viewControlsGroup.appendChild(timeToggleButton);
    viewControlsGroup.appendChild(participantsToggleButton);
    viewControlsGroup.appendChild(wikilinksToggleButton);
    controlsWrapper.appendChild(viewControlsGroup);
    headerEl.appendChild(controlsWrapper);
    return headerEl;
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