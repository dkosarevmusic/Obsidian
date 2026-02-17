/**
 * @file header-component.js
 * Компонент для создания шапки календаря с навигацией.
 */
if (!window.OJSC) window.OJSC = {};
if (!OJSC.ui) OJSC.ui = {};

OJSC.ui.createHeader = (dv, viewDate, viewType) => {
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
        OJSC.renderCalendar(dv, viewDate, newViewType);
    };

    // --- Title ---
    const { title, navStep } = OJSC.ui.getViewParameters(viewDate, viewType);
    const titleEl = document.createElement('h2');
    titleEl.textContent = title;

    // --- Navigation Buttons ---
    const createNavButton = (text, onClick) => {
        const button = document.createElement('button');
        button.textContent = text;
        button.onclick = onClick;
        return button;
    };

    const buttonGroup = document.createElement('div');
    buttonGroup.className = 'ojsc-button-group';

    const mainNavGroup = document.createElement('div');
    mainNavGroup.className = 'ojsc-main-nav-group';
    mainNavGroup.append(
        createNavButton('<', () => OJSC.renderCalendar(dv, viewDate.minus(navStep), viewType)),
        createNavButton('Сегодня', () => OJSC.renderCalendar(dv, luxon.DateTime.now(), viewType)),
        createNavButton('>', () => OJSC.renderCalendar(dv, viewDate.plus(navStep), viewType))
    );

    buttonGroup.append(mainNavGroup);

    const previousView = OJSC.state.getPreviousView();
    if (viewType === '1day' && previousView) {
        const backButton = document.createElement('button');
        backButton.textContent = 'Назад';
        backButton.className = 'ojsc-back-button';
        backButton.onclick = () => {
            OJSC.state.setPreviousView(null);
            const lastState = OJSC.state.load(); // Загружаем последнюю дату для того вида
            OJSC.renderCalendar(dv, lastState.viewDate, previousView);
        };
        viewControlsGroup.appendChild(backButton);
    }
    viewControlsGroup.appendChild(viewSelector);
    headerEl.append(buttonGroup, titleEl, viewControlsGroup);
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