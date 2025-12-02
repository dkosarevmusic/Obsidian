/**
 * Вспомогательные функции для календаря.
 */
if (!window.OJSC) window.OJSC = {};
OJSC.utils = {
     /**
      * Форматирует объект даты в строку YYYY-MM-DD.
      * @param {luxon.DateTime} luxonDate - Объект Luxon DateTime.
      * @returns {string} - Отформатированная строка.
      */
     formatDate: (luxonDate) => {
         if (!luxonDate || !luxonDate.isValid) return '';
         return luxonDate.toFormat('yyyy-MM-dd');
     },

     /**
      * Генерирует стили для элемента задачи на основе цвета области (Area).
      * @param {string} area - Название области задачи.
      * @returns {{backgroundColor: string, color: string, borderColor: string}}
      */
     getTaskStyles: (area) => {
        const colorMap = OJSC.config.areaColors;
         let hslColor = colorMap[area] || 'hsl(0,0%,80%)'; // Цвет по умолчанию
 
         // Разбираем HSL-строку на компоненты
         const match = hslColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
         if (match) {
             const [, h, s, l] = match.map(Number);
             const threshold = OJSC.config.darkColorLightnessThreshold;
 
             // Если цвет "тёмный" (светлота l < порога)
             if (l < threshold) {
                 return {
                     // Фон делаем очень прозрачным
                     backgroundColor: `hsla(${h},${s}%,${l}%,0.1)`,
                     // А текст делаем светлее для контраста
                     color: `hsl(${h},${s}%,75%)`,
                     borderColor: `hsl(${h},${s}%,${l}%)` // Рамка остается исходного цвета
                 };
             }
         }
 
         // Стандартное поведение для светлых цветов
         return {
             backgroundColor: hslColor.replace('hsl(', 'hsla(').replace(')', ',0.2)'),
             color: hslColor,
             borderColor: hslColor
         };
     },

     /**
      * Сравнивает две задачи для комплексной сортировки (логика из Time KanBan).
      * @param {object} a - Первая задача (страница)
      * @param {object} b - Вторая задача (страница)
      * @returns {number}
      */
     compareTasks: (a, b) => {
        const aStatus = Array.isArray(a.status) ? a.status : [String(a.status)];
        const bStatus = Array.isArray(b.status) ? b.status : [String(b.status)];

        /**
         * Нормализует поле (которое может быть строкой, ссылкой, массивом) в строку для сравнения.
         */
        function getComparableString(field, isLink = false) {
            if (!field) return "";
            const arr = Array.isArray(field) ? field : [field];
            const items = isLink 
                ? arr.map(l => (typeof l === 'string' ? l : l.path))
                : arr.map(String);
            return items.sort().join('|');
        }

        // Используем "цепочку" сравнений. Если результат не 0, возвращаем его.
        return (
            // 1. По статусу "important" (важные задачи всегда выше).
            (bStatus.includes('important') || false) - (aStatus.includes('important') || false) ||

            // 2. По времени (задачи со временем выше, затем сортировка по значению).
            (!!b.time - !!a.time) ||
            (() => {
                let timeA = a.time === null || typeof a.time === 'undefined' ? '' : a.time;
                let timeB = b.time === null || typeof b.time === 'undefined' ? '' : b.time;

                if (typeof timeA === 'number') timeA = String(timeA).padStart(4, '0');
                if (typeof timeB === 'number') timeB = String(timeB).padStart(4, '0');
                
                return String(timeA).localeCompare(String(timeB));
            })() ||

            // 3. По остальным полям для стабильной сортировки.
            getComparableString(aStatus).localeCompare(getComparableString(bStatus)) ||
            getComparableString(a.Area).localeCompare(getComparableString(b.Area)) ||
            getComparableString(a.wikilinks, true).localeCompare(getComparableString(b.wikilinks, true)) ||

            // 4. По имени файла как последний критерий.
            a.file.name.localeCompare(b.file.name)
        );
     },

    /**
     * Создает карточку для одного дня с задачами.
     * @param {luxon.DateTime} dayDate - Дата дня.
     * @param {object} tasksByDate - Сгруппированные задачи.
     * @returns {HTMLElement} - HTML-элемент карточки дня.
     */
    createDayCard: (dayDate, tasksByDate) => {
        const dayKey = dayDate.toISODate();
        const dayTasks = tasksByDate[dayKey] || [];

        const card = document.createElement('div');
        card.className = 'ojsc-day-card';
        if (dayDate.toISODate() === luxon.DateTime.now().toISODate()) {
            card.classList.add('ojsc-today');
        }

        const header = document.createElement('div');
        header.className = 'ojsc-day-card-header';

        // По умолчанию ставим только номер дня. Для 3-дневного вида будет перезаписано в main.js
        const daySpan = document.createElement('span');
        daySpan.textContent = dayDate.day;

        if (dayDate.hasSame(luxon.DateTime.now(), 'day')) {
            daySpan.classList.add('ojsc-today-number');
        }
        header.appendChild(daySpan);

        card.appendChild(header); 

        const taskList = document.createElement('ul');
        taskList.className = 'ojsc-task-list';

        if (dayTasks.length > 0) {
            dayTasks.sort(OJSC.utils.compareTasks).forEach(task => {
                const li = document.createElement('li');
                li.className = 'ojsc-task-item';
                const link = document.createElement('a');

                if (task.Area) {
                    const styles = OJSC.utils.getTaskStyles(task.Area);
                    li.style.backgroundColor = styles.backgroundColor;
                    link.style.color = styles.color;
                    li.style.borderLeft = `3px solid ${styles.borderColor}`;
                }

                link.textContent = task[OJSC.config.summaryField] || task.file.name;
                link.className = 'internal-link';
                link.href = task.file.path;
                li.appendChild(link);
                taskList.appendChild(li);
            });
        } else {
            const li = document.createElement('li');
            li.className = 'ojsc-no-tasks';
            li.textContent = 'Нет задач';
            taskList.appendChild(li);
        }

        card.appendChild(taskList);
        return card;
    },

    /**
     * Создает карточку дня с двухстрочными задачами (для 3-дневного вида).
     * @param {luxon.DateTime} dayDate - Дата дня.
     * @param {object} tasksByDate - Сгруппированные задачи.
     * @returns {HTMLElement} - HTML-элемент карточки дня.
     */
    createDayCardFor3Days: (dayDate, tasksByDate) => {
        const card = OJSC.utils.createDayCard(dayDate, tasksByDate); // Используем базовую функцию для создания карточки
        const taskList = card.querySelector('.ojsc-task-list');
        taskList.innerHTML = ''; // Очищаем список задач, созданный базовой функцией

        const dayKey = dayDate.toISODate();
        const dayTasks = tasksByDate[dayKey] || [];

        if (dayTasks.length > 0) {
            dayTasks.sort(OJSC.utils.compareTasks).forEach(task => {
                const li = document.createElement('li');
                li.className = 'ojsc-task-item';

                // Создаем контейнер для двух строк
                const taskContent = document.createElement('a');
                taskContent.className = 'internal-link ojsc-task-content-3day';
                taskContent.href = task.file.path;

                // Верхняя строка: Время
                const timeEl = document.createElement('div');
                timeEl.className = 'ojsc-task-time';
                if (task.time) {
                    const timeStr = String(task.time).padStart(4, '0');
                    timeEl.textContent = `${timeStr.slice(0, 2)}:${timeStr.slice(2, 4)}`;
                } else {
                    timeEl.textContent = '\u00A0'; // Неразрывный пробел, чтобы сохранить высоту
                }
                taskContent.appendChild(timeEl);

                // Нижняя строка: Название задачи
                const summaryEl = document.createElement('div');
                summaryEl.className = 'ojsc-task-summary';
                summaryEl.textContent = task[OJSC.config.summaryField] || task.file.name;
                taskContent.appendChild(summaryEl);

                li.appendChild(taskContent);

                // Применяем стили области (Area)
                if (task.Area) {
                    const styles = OJSC.utils.getTaskStyles(task.Area);
                    li.style.backgroundColor = styles.backgroundColor;
                    li.style.borderLeft = `3px solid ${styles.borderColor}`;
                    // Устанавливаем цвет для текста, который унаследует и подчеркивание
                    // timeEl.style.color = styles.color; // Убираем цвет у времени
                    summaryEl.style.textDecorationColor = styles.color; // Задаем цвет подчеркивания для названия
                    summaryEl.style.color = styles.color;
                }

                taskList.appendChild(li);
            });
        } else {
            // Если задач нет, возвращаем стандартное сообщение
            const li = document.createElement('li');
            li.className = 'ojsc-no-tasks';
            li.textContent = 'Нет задач';
            taskList.appendChild(li);
        }

        // Перезаписываем заголовок для 3-дневного вида
        const header = card.querySelector('.ojsc-day-card-header');
        header.textContent = dayDate.setLocale('ru').toFormat('cccc, dd.MM.yyyy');
        header.style.textAlign = 'left';
        return card;
    },

    /**
     * Создает и возвращает HTML-элемент для сетки одного месяца.
     * @param {luxon.DateTime} monthDate - Дата, определяющая отображаемый месяц.
     * @param {object} tasksByDate - Сгруппированные задачи.
     * @returns {HTMLElement} - Элемент `<div>` для одного месяца.
     */
    createMonthGrid: (monthDate, tasksByDate) => {
        const monthContainer = document.createElement('div');
        monthContainer.className = 'ojsc-month-container';

        const weekdaysHeader = document.createElement('div');
        weekdaysHeader.className = 'ojsc-weekdays-header';
        ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].forEach((day, index) => {
            const weekday = document.createElement('div');
            weekday.textContent = day;
            weekday.className = 'ojsc-weekday'; // Базовый класс для плашки
            // Индексы 5 (Сб) и 6 (Вс) - это выходные
            if (index >= 5) {
                weekday.classList.add('ojsc-weekend');
            }
            weekdaysHeader.appendChild(weekday);
        });
        monthContainer.appendChild(weekdaysHeader);

        const grid = document.createElement('div');
        grid.className = 'ojsc-month-grid';
        
        let currentDay = monthDate.startOf('month').startOf('week');
        const endDay = monthDate.endOf('month').endOf('week');

        while (currentDay <= endDay) {
            const card = OJSC.utils.createDayCard(currentDay, tasksByDate);
            card.classList.add('ojsc-month-grid-card'); // Добавляем класс для специфичных стилей
            if (currentDay.month !== monthDate.month) {
                card.classList.add('ojsc-other-month');
            }
            grid.appendChild(card);
            currentDay = currentDay.plus({ days: 1 });
        }
        monthContainer.appendChild(grid);
        return monthContainer;
    },
    /**
     * Возвращает строку со всеми CSS-стилями для календаря.
     * @returns {string}
     */
    /**
     * Возвращает строку со всеми CSS-стилями для календаря.
     * @returns {string}
     */
    getStyles: () => {
        return `
        .ojsc-container {
            width: 100%;
            margin-top: 20px; /* Добавляем отступ сверху, чтобы выпадающий список не обрезался */
        }
        .ojsc-footer {
            text-align: right;
            font-size: 0.8em;
            color: var(--text-muted);
            margin-top: 10px;
            padding-right: 5px;
        }

        .ojsc-calendar-header { position: relative; display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px; gap: 10px; padding: 8px 12px; background-color: var(--background-secondary); border-radius: 6px; }
        .ojsc-button-group { display: flex; gap: 5px; }
        .ojsc-calendar-header select, .ojsc-calendar-header button { background-color: var(--background-modifier-form-field); color: var(--text-normal); border: 1px solid var(--background-modifier-border); border-radius: 4px; padding: 4px 8px; }
        .ojsc-calendar-header h2 { position: absolute; left: 50%; transform: translateX(-50%); margin: 0; text-transform: capitalize; color: white; text-align: center; }
        .ojsc-multi-month-header { 
            text-align: center; 
            text-transform: capitalize; 
            margin-top: 20px; 
            margin-bottom: 5px; 
            background-color: var(--background-secondary);
            color: var(--text-accent) !important;
            padding: 6px 0;
            border-radius: 6px;
        }
        /* Убираем верхний отступ у самого первого заголовка месяца в многомесячных видах */
        .ojsc-multi-month-header:first-of-type {
            margin-top: 0;
        }

        /* Стили для 3-дневного вида */
        .ojsc-day-list {
            display: flex;
            flex-direction: row;
            gap: 10px;
        }
        .ojsc-day-card {
            border: 1px solid var(--background-modifier-border);
            border-radius: 6px;
            padding: 8px;
            background-color: var(--background-secondary);
            flex: 1;
            min-width: 0; /* Предотвращает переполнение контентом */
            display: flex;
            flex-direction: column;
        }
        .ojsc-day-card.ojsc-today {
            border-color: var(--text-accent);
        }
        .ojsc-day-card-header {
            font-weight: bold;
            margin-bottom: 4px;
        }
        .ojsc-day-card .ojsc-task-list {
            list-style: none;
            padding: 0; /* Убираем внутренние отступы списка */
            margin: 8px 0 0 0; /* Убираем отрицательный margin у списка */
            font-size: 0.9em;
        }
        .ojsc-day-card .ojsc-task-item {
            margin-bottom: 4px;
            padding: 1px 6px;
            border-radius: 4px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .ojsc-day-card .ojsc-no-tasks {
            color: var(--text-muted);
            font-style: italic;
            padding: 4px 0;
        }
        /* Стили для 3-дневного вида */
        .ojsc-day-list .ojsc-day-card-header {
            padding-bottom: 8px;
            border-bottom: 1px solid var(--background-modifier-border);
            min-height: 1.8em; /* Выравниваем высоту заголовка с другими режимами */
        }
        .ojsc-task-content-3day {
            display: flex;
            flex-direction: column;
            text-decoration: none; /* Убираем подчеркивание по умолчанию */
        }
        .ojsc-task-time {
            font-size: 0.9em;
            opacity: 1;
            font-weight: 600; /* Оставляем время полужирным */
        }
        .ojsc-task-summary {
            font-weight: 500;
            text-decoration: underline; /* Переносим подчеркивание на название задачи */
        }
        .ojsc-day-list .ojsc-task-item {
            padding-top: 4px;
            padding-bottom: 4px;
        }
        /* Стили для сеток (месяц, год) */
        .ojsc-month-container { margin-bottom: 20px; }
        .ojsc-weekdays-header {
            display: grid;
            grid-template-columns: repeat(7, 1fr);
            gap: 5px; /* Отступ между плашками */
            margin-bottom: 5px;
        }
        .ojsc-weekday {
            background-color: var(--background-secondary);
            color: var(--text-muted);
            padding: 4px 0;
            border-radius: 4px;
            text-align: center;
            font-size: 0.85em;
            font-weight: 600;
        }
        .ojsc-weekday.ojsc-weekend {
            color: var(--text-accent);
        }
        .ojsc-month-grid {
            display: grid;
            grid-template-columns: repeat(7, 1fr);
            gap: 5px;
        }
        .ojsc-month-grid-card {
            min-height: 100px;
            padding: 4px;
        }
        .ojsc-month-grid-card .ojsc-day-card-header {
            font-size: 0.9em;
            text-align: right;
            min-height: 1.8em; /* Задаем минимальную высоту, равную высоте кружка */
        }
        .ojsc-month-grid-card.ojsc-other-month {
            opacity: 0.5;
        }
        .ojsc-today-number {
            background-color: var(--text-accent);
            color: var(--text-on-accent, white);
            border-radius: 50%;
            display: inline-block;
            width: 1.8em; height: 1.8em; line-height: 1.8em;
            text-align: center;
        }

        /* --- Кастомные сдвиги для разных режимов --- */
        /* Для 3-дневного вида, компенсируем padding: 8px у .ojsc-day-card */
        .ojsc-day-list .ojsc-task-item {
            margin-left: -2px; /* Сдвиг вправо на 1px */
        }
        /* Для месячного вида, компенсируем padding: 4px у .ojsc-month-grid-card */
        .ojsc-month-grid .ojsc-task-item {
            margin-left: 2px; /* Сдвиг вправо на 1px */
        }
    `;
    }
};