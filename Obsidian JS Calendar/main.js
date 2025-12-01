/**
 * Основная логика для получения данных и рендеринга календаря.
 */

/**
 * Получает задачи из хранилища на основе конфигурации.
 * @param {object} dv - Глобальный объект API Dataview.
 * @returns {Array<object>} - Массив страниц (задач).
 */
function getTasks(dv) {
     const source = OJSC.config.source;
     const dateField = OJSC.config.dateField;
     const statusField = OJSC.config.statusField;
     const allowedStatuses = OJSC.config.allowedStatuses;

     // Загружаем страницы, где есть поле с датой и статус из списка разрешенных
     return dv.pages(source).where(p =>
         p[dateField] &&
         p[statusField] &&
         allowedStatuses.includes(p[statusField])
     );
}

/**
 * Группирует задачи по датам в формате 'yyyy-MM-dd'.
 * @param {Array<object>} tasks - Массив задач от Dataview.
 * @returns {object} - Объект, где ключи - это даты, а значения - массивы задач.
 */
function groupTasksByDate(tasks) {
    const tasksByDate = {};
    tasks.forEach(task => {
        const dateField = task[OJSC.config.dateField];
        if (dateField) {
            const dateStr = OJSC.utils.formatDate(dateField);
            if (!tasksByDate[dateStr]) tasksByDate[dateStr] = [];
            tasksByDate[dateStr].push(task);
        }
    });
    return tasksByDate;
}

/**
 * Создает и возвращает HTML-элемент для одной ячейки дня.
 * @param {luxon.DateTime} day - Текущий день для рендеринга.
 * @param {luxon.DateTime} viewDate - Отображаемая дата (для определения текущего месяца).
 * @param {object} tasksByDate - Сгруппированные задачи.
 * @returns {HTMLElement} - Элемент `<td>`.
 */
function createDayCell(day, viewDate, tasksByDate) {
    const cell = document.createElement('td');
    cell.className = 'ojsc-day-cell';

    // Внутренняя обертка для flex-контейнера, чтобы не ломать разметку таблицы
    const cellInner = document.createElement('div');
    cellInner.className = 'ojsc-day-cell-inner';

    // Стилизация ячейки
    if (day.month !== viewDate.month) {
        cell.classList.add('ojsc-other-month');
    }
    if (day.hasSame(luxon.DateTime.now(), 'day')) {
        cell.classList.add('ojsc-today');
    }

    // Номер дня
    const dayNumber = document.createElement('div');
    dayNumber.className = 'ojsc-day-number';
    dayNumber.textContent = day.day;
    cellInner.appendChild(dayNumber);

    // Список задач
    const dateStr = day.toFormat('yyyy-MM-dd');
    if (tasksByDate[dateStr]) {
        const taskListEl = document.createElement('ul');
        taskListEl.className = 'ojsc-task-list';
        tasksByDate[dateStr].forEach(task => {
            const taskItem = document.createElement('li');
            taskItem.className = 'ojsc-task-item';

            // Применяем стили на основе поля 'Area'
            const link = document.createElement('a');
            if (task.Area) {
                const styles = OJSC.utils.getTaskStyles(task.Area);
                taskItem.style.backgroundColor = styles.backgroundColor;
                // Устанавливаем цвет для самой ссылки, а не для всего li
                link.style.color = styles.color;
            }

            link.textContent = task[OJSC.config.summaryField] || task.file.name;
            link.className = 'internal-link';
            link.href = task.file.path;
            taskItem.appendChild(link);

            taskListEl.appendChild(taskItem);
        });
        cellInner.appendChild(taskListEl);
    }

    cell.appendChild(cellInner);
    return cell;
}

/**
 * Возвращает строку со всеми CSS-стилями для календаря.
 * @returns {string}
 */
function getStyles() {
    return `
        .ojsc-container {
            width: 100%;
        }
        .ojsc-calendar { 
            border-collapse: collapse; 
            width: 100%; 
            border: 1px solid var(--background-modifier-border); 
            table-layout: fixed; 
        }
        .ojsc-calendar th, .ojsc-calendar td { 
            border: 1px solid var(--background-modifier-border); 
            padding: 8px; 
            vertical-align: top; 
            width: 14.28%; 
        }
        .ojsc-weekday-header { 
            background-color: var(--background-secondary); 
            text-align: center; 
        }
        .ojsc-day-cell { 
            height: 120px; 
            overflow: hidden;
        }
        .ojsc-day-cell-inner {
            height: 100%;
            display: flex; 
            flex-direction: column;
            margin: -8px; /* Компенсируем padding родительской ячейки */
            padding: 8px 0; /* <-- [СДВИГ 1] Внутренние отступы всей ячейки (0 по бокам для макс. ширины) */
        }
        .ojsc-day-number { font-size: 0.9em; font-weight: bold; margin-bottom: 4px; margin-left: 8px; }
        .ojsc-other-month .ojsc-day-number { color: var(--text-muted); opacity: 0.7; }
        .ojsc-today .ojsc-day-number { 
            background-color: var(--text-accent); 
            color: var(--text-on-accent, white);
            border-radius: 50%;
            width: 1.8em;
            height: 1.8em;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 4px;
        }
        .ojsc-task-list { list-style: none; padding: 0 4px 0 0; margin: 5px 0 0 -18px; font-size: 0.85em; /* <-- [СДВИГ 2] Отрицательный отступ для "вытягивания" списка задач */ }
        .ojsc-task-item { 
            margin-bottom: 4px; 
            white-space: nowrap; 
            overflow: hidden; 
            text-overflow: ellipsis; 
            background-color: hsla(var(--mono-rgb-100), 0.07); /* var(--background-secondary) не всегда работает */
            border-radius: 4px;
            padding: 2px 4px; /* <-- [СДВИГ 3] Внутренний отступ для текста внутри прямоугольника */
        }
        /* Цвет ссылки наследуется от родителя (.ojsc-task-item) */
        .ojsc-task-item a { display: block; overflow: hidden; text-overflow: ellipsis; }
        .ojsc-calendar-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .ojsc-calendar-header h2 { margin: 0; text-transform: capitalize; }
    `;
}

/**
 * Основная функция для отрисовки календаря.
 * @param {object} dv - Глобальный объект API Dataview.
 * @param {luxon.DateTime} viewDate - Дата для отображения (по умолчанию сегодня).
 */
OJSC.renderCalendar = (dv, viewDate = luxon.DateTime.now()) => {
    const container = dv.container;
    container.innerHTML = ''; // Очищаем контейнер перед отрисовкой

    // 1. Получаем и группируем данные
    const tasks = getTasks(dv);
    const tasksByDate = groupTasksByDate(tasks);

    // 2. Создаем корневой элемент, который будет содержать и стили, и HTML
    const rootEl = document.createElement('div');
    rootEl.className = 'ojsc-container';
    
    // Добавляем стили прямо в корневой элемент
    const styleEl = document.createElement('style');
    styleEl.textContent = getStyles();
    rootEl.appendChild(styleEl);

    // Заголовок
    const headerEl = document.createElement('div');
    headerEl.className = 'ojsc-calendar-header';
    const monthName = viewDate.setLocale('ru').toFormat('LLLL yyyy');
    headerEl.innerHTML = `<h2>${monthName}</h2>`; // TODO: Добавить кнопки навигации
    rootEl.appendChild(headerEl);

    // Таблица
    const table = document.createElement('table');
    table.className = 'ojsc-calendar';

    // Шапка таблицы (Пн-Вс)
    const thead = table.createTHead();
    const weekdaysRow = thead.insertRow();
    ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].forEach(day => {
        const th = document.createElement('th');
        th.textContent = day;
        th.className = 'ojsc-weekday-header';
        weekdaysRow.appendChild(th);
    });

    // Тело таблицы (дни)
    const tbody = table.createTBody();
    let currentDay = viewDate.startOf('month').startOf('week');
    const endDay = viewDate.endOf('month').endOf('week');

    while (currentDay <= endDay) {
        const weekRow = tbody.insertRow();
        for (let i = 0; i < 7; i++) {
            const cell = createDayCell(currentDay, viewDate, tasksByDate);
            weekRow.appendChild(cell);
            currentDay = currentDay.plus({ days: 1 });
        }
    }
    rootEl.appendChild(table);

    // 3. Добавляем собранный календарь на страницу
    container.appendChild(rootEl);
};