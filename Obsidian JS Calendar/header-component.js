/**
 * @file header-component.js
 * Компонент для создания шапки календаря с навигацией.
 */
if (!window.OJSC) window.OJSC = {};
if (!OJSC.ui) OJSC.ui = {};

OJSC.ui.createHeader = (dv, viewDate, viewType) => {
    const headerEl = document.createElement('div');
    headerEl.className = 'ojsc-calendar-header';

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
    const prevButton = document.createElement('button');
    prevButton.textContent = '<';
    prevButton.onclick = () => OJSC.renderCalendar(dv, viewDate.minus(navStep), viewType);

    const nextButton = document.createElement('button');
    nextButton.textContent = '>';
    nextButton.onclick = () => OJSC.renderCalendar(dv, viewDate.plus(navStep), viewType);

    const todayButton = document.createElement('button');
    todayButton.textContent = 'Сегодня';
    todayButton.onclick = () => OJSC.renderCalendar(dv, luxon.DateTime.now(), viewType);

    const buttonGroup = document.createElement('div');
    buttonGroup.className = 'ojsc-button-group';

    const mainNavGroup = document.createElement('div');
    mainNavGroup.className = 'ojsc-main-nav-group';
    mainNavGroup.append(prevButton, todayButton, nextButton);

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
        buttonGroup.append(mainNavGroup, backButton);
    } else {
        buttonGroup.append(mainNavGroup);
    }

    headerEl.append(buttonGroup, titleEl, viewSelector);
    return headerEl;
};

OJSC.ui.getViewParameters = (viewDate, viewType) => {
    if (viewType === '1day') {
        return { title: viewDate.setLocale('ru').toFormat('d MMMM yyyy'), navStep: { days: 1 } };
    }
    if (viewType === 'month') {
        return { title: viewDate.setLocale('ru').toFormat('LLLL yyyy'), navStep: { months: 1 } };
    }
    if (viewType === '3months') {
        const endPeriod = viewDate.plus({ months: 2 });
        return { title: `${viewDate.setLocale('ru').toFormat('LLL yyyy')} - ${endPeriod.setLocale('ru').toFormat('LLL yyyy')}`, navStep: { months: 1 } };
    }
    if (viewType === 'year') {
        return { title: viewDate.toFormat('yyyy'), navStep: { years: 1 } };
    }
    return { title: '', navStep: {} };
};