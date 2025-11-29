/**
 * Основная логика для получения данных и рендеринга календаря.
 */
const luxon = dv.luxon;

/**
 * Получает задачи из хранилища на основе конфигурации.
 * @param {object} dv - Глобальный объект API Dataview.
 * @returns {Array} - Массив страниц (задач).
 */
function getTasks(dv) {
     const source = OJSC.config.source;
     const dateField = OJSC.config.dateField;
     // Загружаем страницы, где есть указанное поле с датой
     return dv.pages(source).where(p => p[dateField]);
}

/**
 * Основная функция для отрисовки календаря.
 * @param {object} dv - Глобальный объект API Dataview.
 * @param {luxon.DateTime} viewDate - Дата для отображения (по умолчанию сегодня).
 */
OJSC.renderCalendar = (dv, viewDate = luxon.luxon.now()) => {
    const container = dv.container;
    container.innerHTML = ''; // Очищаем контейнер перед отрисовкой

    // --- 1. Стили для календаря ---
    const styles = `
        .ojsc-calendar { border-collapse: collapse; width: 100%; border: 1px solid var(--background-modifier-border); }
        .ojsc-calendar th, .ojsc-calendar td { border: 1px solid var(--background-modifier-border); padding: 8px; vertical-align: top; }
        .ojsc-calendar th { background-color: var(--background-secondary-alt); text-align: center; }
        .ojsc-calendar .ojsc-day-cell { height: 120px; }
        .ojsc-calendar .ojsc-day-number { font-size: 0.9em; font-weight: bold; }
        .ojsc-calendar .ojsc-other-month .ojsc-day-number { color: var(--text-muted); }
        .ojsc-calendar .ojsc-today .ojsc-day-number { color: var(--text-accent); }
        .ojsc-calendar .ojsc-task-list { list-style: none; padding: 0; margin: 5px 0 0 0; font-size: 0.85em; }
        .ojsc-calendar .ojsc-task-item { margin-bottom: 4px; }
        .ojsc-calendar-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .ojsc-calendar-header h2 { margin: 0; text-transform: capitalize; }
    `;
    const styleEl = document.createElement('style');
    styleEl.innerHTML = styles;
    container.appendChild(styleEl);

    // --- 2. Получение и группировка задач ---
    const tasks = getTasks(dv);
    const tasksByDate = {};
    tasks.forEach(task => {
        const dateField = task[OJSC.config.dateField];
        if (dateField) {
            const dateStr = OJSC.utils.formatDate(dateField.toJSDate());
            if (!tasksByDate[dateStr]) {
                tasksByDate[dateStr] = [];
            }
            tasksByDate[dateStr].push(task);
        }
    });

    // --- 3. Отрисовка заголовка ---
    const headerEl = document.createElement('div');
    headerEl.className = 'ojsc-calendar-header';
    const monthName = viewDate.setLocale('ru').toFormat('LLLL yyyy');
    headerEl.innerHTML = `<h2>${monthName}</h2>`; // TODO: Добавить кнопки навигации
    container.appendChild(headerEl);

    // --- 4. Отрисовка сетки календаря ---
    const table = document.createElement('table');
    table.className = 'ojsc-calendar';

    // Дни недели (Пн-Вс)
    const thead = table.createTHead();
    const weekdaysRow = thead.insertRow();
    const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    weekdays.forEach(day => {
        const th = document.createElement('th');
        th.textContent = day;
        weekdaysRow.appendChild(th);
    });

    // Дни месяца
    const tbody = table.createTBody();
    const startOfMonth = viewDate.startOf('month');
    const endOfMonth = viewDate.endOf('month');
    // Начинаем с понедельника недели, в которой находится первый день месяца
    let currentDay = startOfMonth.startOf('week');

    const todayStr = luxon.luxon.now().toFormat('yyyy-MM-dd');

    while (currentDay <= endOfMonth.endOf('week')) {
        const weekRow = tbody.insertRow();
        for (let i = 0; i < 7; i++) {
            const cell = weekRow.insertCell();
            cell.className = 'ojsc-day-cell';

            // Стилизация ячейки
            if (currentDay.month !== viewDate.month) {
                cell.classList.add('ojsc-other-month');
            }
            if (currentDay.toFormat('yyyy-MM-dd') === todayStr) {
                cell.classList.add('ojsc-today');
            }

            // Номер дня
            const dayNumber = document.createElement('div');
            dayNumber.className = 'ojsc-day-number';
            dayNumber.textContent = currentDay.day;
            cell.appendChild(dayNumber);

            // Список задач
            const dateStr = currentDay.toFormat('yyyy-MM-dd');
            if (tasksByDate[dateStr]) {
                const taskListEl = document.createElement('ul');
                taskListEl.className = 'ojsc-task-list';
                tasksByDate[dateStr].forEach(task => {
                    const taskItem = document.createElement('li');
                    taskItem.className = 'ojsc-task-item';
                    // Создаем ссылку на заметку
                    const link = dv.fileLink(task.file.path, task[OJSC.config.summaryField] || task.file.name);
                    taskItem.appendChild(link);
                    taskListEl.appendChild(taskItem);
                });
                cell.appendChild(taskListEl);
            }

            currentDay = currentDay.plus({
                days: 1
            });
        }
    }

    container.appendChild(table);
};