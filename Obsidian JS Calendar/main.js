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
    const views = { month: 'Месяц', '3months': '3 месяца', year: 'Год' };
    for (const [value, text] of Object.entries(views)) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = text;
        if (value === viewType) option.selected = true;
        viewSelector.appendChild(option);
    }
    viewSelector.onchange = (e) => OJSC.renderCalendar(dv, viewDate, e.target.value);

    rootEl.appendChild(headerEl); // <-- Перемещаем добавление заголовка сюда

    // --- Логика отрисовки в зависимости от вида ---
    let title = '';
    let navStep = {};

    if (viewType === 'month') {
        title = viewDate.setLocale('ru').toFormat('LLLL yyyy');
        navStep = { months: 1 };
        const table = OJSC.utils.createMonthTable(viewDate, tasksByDate);
        rootEl.appendChild(table);
    } else if (viewType === '3months') {
        const endPeriod = viewDate.plus({ months: 2 });
        title = `${viewDate.setLocale('ru').toFormat('LLL yyyy')} - ${endPeriod.setLocale('ru').toFormat('LLL yyyy')}`;
        navStep = { months: 1 };
        for (let i = 0; i < 3; i++) {
            const monthDate = viewDate.plus({ months: i });
            const monthHeader = document.createElement('h3');
            monthHeader.className = 'ojsc-multi-month-header';
            monthHeader.textContent = monthDate.setLocale('ru').toFormat('LLLL yyyy');
            rootEl.appendChild(monthHeader);
            rootEl.appendChild(OJSC.utils.createMonthTable(monthDate, tasksByDate));
        }
    } else if (viewType === 'year') {
        title = viewDate.toFormat('yyyy');
        navStep = { years: 1 };
        for (let i = 0; i < 12; i++) {
            const monthDate = viewDate.startOf('year').plus({ months: i });
            const monthHeader = document.createElement('h3');
            monthHeader.className = 'ojsc-multi-month-header';
            monthHeader.textContent = monthDate.setLocale('ru').toFormat('LLLL');
            rootEl.appendChild(monthHeader);
            rootEl.appendChild(OJSC.utils.createMonthTable(monthDate, tasksByDate));
        }
    }

    // --- Собираем заголовок с навигацией и названием ---
    const prevButton = document.createElement('button');
    prevButton.textContent = '<';
    prevButton.onclick = () => OJSC.renderCalendar(dv, viewDate.minus(navStep), viewType);
    const nextButton = document.createElement('button');
    nextButton.textContent = '>';
    nextButton.onclick = () => OJSC.renderCalendar(dv, viewDate.plus(navStep), viewType);
    const titleEl = document.createElement('h2');
    titleEl.textContent = title;

    // Создаем отдельный контейнер для навигации (кнопки + заголовок)
    const navContainer = document.createElement('div');
    navContainer.className = 'ojsc-calendar-navigation';
    navContainer.append(prevButton, titleEl, nextButton);

    headerEl.append(viewSelector, navContainer);

    // 3. Добавляем собранный календарь на страницу
    container.appendChild(rootEl);
};