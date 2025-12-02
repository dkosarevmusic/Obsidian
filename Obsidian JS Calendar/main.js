/**
 * @file main.js
 * Основная точка входа для рендеринга календаря.
 */

function getViewParameters(viewDate, viewType) {
    if (viewType === '3days') {
        return { title: viewDate.setLocale('ru').toFormat('dd MMMM yyyy'), navStep: { days: 1 } };
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
    return { title: '', navStep: {} }; // Default case
}

/**
 * Основная функция для отрисовки календаря.
 * @param {object} dv - Глобальный объект API Dataview.
 * @param {luxon.DateTime} viewDate - Дата для отображения (по умолчанию сегодня).
 * @param {string} viewType - Тип вида ('month', '3months', 'year').
 */
OJSC.renderCalendar = (dv, viewDate = luxon.DateTime.now(), viewType = 'month') => {
    const container = dv.container;
    container.innerHTML = ''; // Очищаем контейнер перед отрисовкой

    // 1. Получаем и группируем данные
    const tasks = OJSC.data.getTasks(dv);
    const tasksByDate = OJSC.data.groupTasksByDate(tasks);

    // 2. Создаем корневой элемент, который будет содержать и стили, и HTML
    const rootEl = document.createElement('div');
    rootEl.className = 'ojsc-container';
    
    const styleEl = document.createElement('style');
    styleEl.textContent = OJSC.utils.getStyles();
    rootEl.appendChild(styleEl);

    // --- Заголовок с навигацией ---
    const headerEl = document.createElement('div');
    headerEl.className = 'ojsc-calendar-header';

    // Выпадающий список для выбора вида
    const viewSelector = document.createElement('select');
    const views = { '3days': '3 дня', month: 'Месяц', '3months': '3 месяца', year: 'Год' };
    for (const [value, text] of Object.entries(views)) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = text;
        if (value === viewType) option.selected = true;
        viewSelector.appendChild(option);
    }
    viewSelector.onchange = (e) => OJSC.renderCalendar(dv, viewDate, e.target.value);

    rootEl.appendChild(headerEl);

    // --- Определение параметров и отрисовка тела календаря ---
    const { title, navStep } = getViewParameters(viewDate, viewType);
    const bodyFragment = document.createDocumentFragment();

    if (viewType === '3days') {
        const list = document.createElement('div');
        list.className = 'ojsc-day-list';
        for (let i = -1; i <= 1; i++) {
            const dayDate = viewDate.plus({ days: i }); // Отображаем вчера, сегодня, завтра относительно viewDate
            const card = OJSC.utils.createDayCard(dayDate, tasksByDate);
            const header = card.querySelector('.ojsc-day-card-header');
            header.textContent = dayDate.setLocale('ru').toFormat('cccc, dd.MM.yyyy');
            header.style.textAlign = 'left'; // Для 3-дневного вида выравниваем заголовок влево
            list.appendChild(card);
        }
        bodyFragment.appendChild(list);
    } else if (viewType === 'month') {
        bodyFragment.appendChild(OJSC.utils.createMonthGrid(viewDate, tasksByDate));
    } else if (viewType === '3months') {
        for (let i = 0; i < 3; i++) {
            const monthDate = viewDate.plus({ months: i });
            const monthHeader = document.createElement('h3');
            monthHeader.className = 'ojsc-multi-month-header';
            monthHeader.textContent = monthDate.setLocale('ru').toFormat('LLLL yyyy');
            bodyFragment.append(monthHeader, OJSC.utils.createMonthGrid(monthDate, tasksByDate));
        }
    } else if (viewType === 'year') {
        for (let i = 0; i < 12; i++) {
            const monthDate = viewDate.startOf('year').plus({ months: i });
            const monthHeader = document.createElement('h3');
            monthHeader.className = 'ojsc-multi-month-header';
            monthHeader.textContent = monthDate.setLocale('ru').toFormat('LLLL');
            bodyFragment.append(monthHeader, OJSC.utils.createMonthGrid(monthDate, tasksByDate));
        }
    }

    // Добавляем собранное тело календаря в DOM одной операцией
    rootEl.appendChild(bodyFragment);

    // --- Собираем заголовок с навигацией и названием ---
    const prevButton = document.createElement('button');
    prevButton.textContent = '<';
    prevButton.onclick = () => OJSC.renderCalendar(dv, viewDate.minus(navStep), viewType);

    const nextButton = document.createElement('button');
    nextButton.textContent = '>';
    nextButton.onclick = () => OJSC.renderCalendar(dv, viewDate.plus(navStep), viewType);

    const todayButton = document.createElement('button');
    todayButton.textContent = 'Сегодня';
    todayButton.onclick = () => OJSC.renderCalendar(dv, luxon.DateTime.now(), viewType);

    const titleEl = document.createElement('h2');
    titleEl.textContent = title;

    // Группируем кнопки навигации
    const buttonGroup = document.createElement('div');
    buttonGroup.className = 'ojsc-button-group';
    buttonGroup.append(prevButton, todayButton, nextButton);

    // Собираем заголовок: группа кнопок слева, заголовок по центру, селектор справа
    headerEl.append(buttonGroup, titleEl, viewSelector);

    // 3. Добавляем собранный календарь на страницу
    container.appendChild(rootEl);
};