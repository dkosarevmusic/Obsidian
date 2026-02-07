/**
 * @file main.js
 * Основная точка входа для рендеринга календаря.
 */

function getViewParameters(viewDate, viewType) {
    if (viewType === '1day') {
        return { title: viewDate.setLocale('ru').toFormat('d MMMM yyyy'), navStep: { days: 1 } };
    }
    if (viewType === '3days') {
        const startDate = viewDate.minus({ days: 1 });
        const endDate = viewDate.plus({ days: 1 });
        let title;

        if (startDate.month === endDate.month) {
            // Если дни в одном месяце, используем короткий формат: "2 - 4 октября 2023"
            title = `${startDate.toFormat('d')} - ${endDate.setLocale('ru').toFormat('d MMMM yyyy')}`;
        } else {
            // Если дни в разных месяцах: "31 октября - 2 ноября 2023"
            title = `${startDate.setLocale('ru').toFormat('d MMMM')} - ${endDate.setLocale('ru').toFormat('d MMMM yyyy')}`;
        }
        return { title: title, navStep: { days: 1 } };
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
OJSC.renderCalendar = (dv, viewDate = luxon.DateTime.now(), viewType = null) => {
    // Если viewType не передан, пытаемся загрузить его из localStorage. Если и там нет, ставим 'month' по умолчанию.
    const previousView = localStorage.getItem('ojsc_previousView');

    if (viewType === null) {
        viewType = localStorage.getItem('ojsc_lastViewType') || 'month';
        // Если мы переключились на вид, который не является '1day', сбрасываем сохраненный предыдущий вид
        if (viewType !== '1day') localStorage.removeItem('ojsc_previousView');
    }
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
    const views = { '1day': '1 день', '3days': '3 дня', month: 'Месяц', '3months': '3 месяца', year: 'Год' };
    for (const [value, text] of Object.entries(views)) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = text;
        if (value === viewType) option.selected = true;
        viewSelector.appendChild(option);
    }
    viewSelector.onchange = (e) => {
        localStorage.setItem('ojsc_lastViewType', e.target.value); // Сохраняем выбор
        // При ручном переключении вида сбрасываем "память" о предыдущем виде для кнопки "Назад"
        if (e.target.value !== '1day') {
            localStorage.removeItem('ojsc_previousView');
        }
        OJSC.renderCalendar(dv, viewDate, e.target.value);
    };

    rootEl.appendChild(headerEl);

    // --- Определение параметров и отрисовка тела календаря ---
    const { title, navStep } = getViewParameters(viewDate, viewType);
    const bodyFragment = document.createDocumentFragment();

    if (viewType === '1day') {
        const list = document.createElement('div');
        list.className = 'ojsc-day-list'; // Используем тот же класс, что и в 3-дневном виде
        // Используем специальную функцию для детального отображения карточки
        list.appendChild(OJSC.utils.createDayCardFor3Days(viewDate, tasksByDate));
        bodyFragment.appendChild(list);
    } else if (viewType === '3days') {
        const list = document.createElement('div');
        list.className = 'ojsc-day-list';
        for (let i = -1; i <= 1; i++) {
            const dayDate = viewDate.plus({ days: i }); // Отображаем вчера, сегодня, завтра относительно viewDate
            // Используем новую специальную функцию для 3-дневного вида
            list.appendChild(OJSC.utils.createDayCardFor3Days(dayDate, tasksByDate));
        }
        bodyFragment.appendChild(list);
    } else if (viewType === 'month') {
        bodyFragment.appendChild(OJSC.utils.createMonthGrid(viewDate, tasksByDate, viewType, dv));
    } else if (viewType === '3months') {
        for (let i = 0; i < 3; i++) {
            const monthDate = viewDate.plus({ months: i });
            const monthHeader = document.createElement('h3');
            monthHeader.className = 'ojsc-multi-month-header';
            monthHeader.textContent = monthDate.setLocale('ru').toFormat('LLLL yyyy');
            bodyFragment.append(monthHeader, OJSC.utils.createMonthGrid(monthDate, tasksByDate, viewType, dv));
        }
    } else if (viewType === 'year') {
        for (let i = 0; i < 12; i++) {
            const monthDate = viewDate.startOf('year').plus({ months: i });
            const monthHeader = document.createElement('h3');
            monthHeader.className = 'ojsc-multi-month-header';
            monthHeader.textContent = monthDate.setLocale('ru').toFormat('LLLL');
            bodyFragment.append(monthHeader, OJSC.utils.createMonthGrid(monthDate, tasksByDate, viewType, dv));
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

    // Создаем отдельную группу для основной навигации
    const mainNavGroup = document.createElement('div');
    mainNavGroup.className = 'ojsc-main-nav-group';
    mainNavGroup.append(prevButton, todayButton, nextButton);

    // Добавляем кнопку "Назад", если мы в режиме '1day' и есть куда возвращаться
    if (viewType === '1day' && previousView) {
        const backButton = document.createElement('button');
        backButton.textContent = 'Назад';
        backButton.className = 'ojsc-back-button'; // Добавляем класс для стилизации
        backButton.onclick = () => {
            localStorage.removeItem('ojsc_previousView'); // Очищаем память после использования
            OJSC.renderCalendar(dv, viewDate, previousView);
        };
        // Добавляем основную навигацию и кнопку "Назад" в правильном порядке
        buttonGroup.append(mainNavGroup, backButton);
    } else {
        // Если кнопки "Назад" нет, добавляем только основную навигацию
        buttonGroup.append(mainNavGroup);
    }

    // Собираем заголовок: группа кнопок слева, заголовок по центру, селектор справа
    headerEl.append(buttonGroup, titleEl, viewSelector);

    // 3. Добавляем собранный календарь на страницу
    container.appendChild(rootEl);

    // --- Плашка с подписью ---
    const footer = document.createElement('div');
    footer.className = 'ojsc-footer';
    footer.textContent = 'Calendar by D.KOSAREV';
    container.appendChild(footer);

    // Сбрасываем скролл к началу календаря при каждой перерисовке
    container.scrollIntoView(true);
};