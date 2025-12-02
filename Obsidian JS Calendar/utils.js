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
     * Создает и возвращает HTML-элемент для одной ячейки дня.
     * @param {luxon.DateTime} day - Текущий день для рендеринга.
     * @param {luxon.DateTime} viewDate - Отображаемая дата (для определения текущего месяца).
     * @param {object} tasksByDate - Сгруппированные задачи.
     * @returns {HTMLElement} - Элемент `<td>`.
     */
    createDayCell: (day, viewDate, tasksByDate) => {
        const cell = document.createElement('td');
        cell.className = 'ojsc-day-cell';

        const cellInner = document.createElement('div');
        cellInner.className = 'ojsc-day-cell-inner';

        if (day.month !== viewDate.month) {
            cell.classList.add('ojsc-other-month');
        }
        if (day.hasSame(luxon.DateTime.now(), 'day')) {
            cell.classList.add('ojsc-today');
        }

        const dayNumber = document.createElement('div');
        dayNumber.className = 'ojsc-day-number';
        dayNumber.textContent = day.day;
        cellInner.appendChild(dayNumber);

        const dateStr = day.toFormat('yyyy-MM-dd');
        if (tasksByDate[dateStr]) {
            const taskListEl = document.createElement('ul');
            taskListEl.className = 'ojsc-task-list';

            tasksByDate[dateStr].sort(OJSC.utils.compareTasks).forEach(task => {
                const taskItem = document.createElement('li');
                taskItem.className = 'ojsc-task-item';

                const link = document.createElement('a');
                if (task.Area) {
                    const styles = OJSC.utils.getTaskStyles(task.Area);
                    taskItem.style.backgroundColor = styles.backgroundColor;
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
    },

    /**
     * Создает и возвращает HTML-элемент для таблицы одного месяца.
     * @param {luxon.DateTime} monthDate - Дата, определяющая отображаемый месяц.
     * @param {object} tasksByDate - Сгруппированные задачи.
     * @returns {HTMLTableElement} - Элемент `<table>` для одного месяца.
     */
    createMonthTable: (monthDate, tasksByDate) => {
        const table = document.createElement('table');
        table.className = 'ojsc-calendar';

        const thead = table.createTHead();
        const weekdaysRow = thead.insertRow();
        ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].forEach(day => {
            const th = document.createElement('th');
            th.textContent = day;
            th.className = 'ojsc-weekday-header';
            weekdaysRow.appendChild(th);
        });

        const tbody = table.createTBody();
        let currentDay = monthDate.startOf('month').startOf('week');
        const endDay = monthDate.endOf('month').endOf('week');

        while (currentDay <= endDay) {
            const weekRow = tbody.insertRow();
            for (let i = 0; i < 7; i++) {
                const cell = OJSC.utils.createDayCell(currentDay, monthDate, tasksByDate);
                weekRow.appendChild(cell);
                currentDay = currentDay.plus({ days: 1 });
            }
        }
        return table;
    },

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
        .ojsc-weekday-header { background-color: var(--background-secondary); text-align: center; }
        .ojsc-day-cell { /* Высота теперь будет автоматической */ }
        .ojsc-day-cell-inner { 
            display: flex; 
            flex-direction: column;
            margin: -8px; /* Компенсируем padding родительской ячейки */
            padding: 8px 0; /* <-- [СДВИГ 1] Внутренние отступы всей ячейки (0 по бокам для макс. ширины) */
        }
        .ojsc-day-number { 
            font-size: 0.9em; font-weight: bold; margin-bottom: 4px;
            /* Резервируем одинаковое пространство для всех номеров дней */
            width: 1.8em; height: 1.8em;
            display: flex; align-items: center;
            /* Сдвигаем обычные дни вправо */
            justify-content: flex-start; padding-left: 8px;
        }
        .ojsc-other-month .ojsc-day-number { color: var(--text-muted); opacity: 0.7; }
        .ojsc-today .ojsc-day-number { 
            background-color: var(--text-accent); 
            color: var(--text-on-accent, white);
            border-radius: 50%;
            /* Центрируем номер внутри круга, убирая отступ */
            justify-content: center;
            padding-left: 0; /* Убираем внутренний отступ, так как центрируем */
            /* Добавляем внешний отступ, чтобы отодвинуть круг от края */
            margin-left: 8px;
        }
        .ojsc-task-list { 
            list-style: none; padding: 0 4px 0 0; margin: 5px 0 0 -18px; font-size: 0.85em; /* <-- [СДВИГ 2] Отрицательный отступ для "вытягивания" списка задач */
            /* Убираем прокрутку и позволяем списку расти */
        }
        .ojsc-task-item { 
            margin-bottom: 4px; 
            white-space: nowrap; 
            overflow: hidden; 
            text-overflow: ellipsis; 
            background-color: hsla(var(--mono-rgb-100), 0.07); /* var(--background-secondary) не всегда работает */
            border-radius: 4px;
            padding: 2px 4px; /* <-- [СДВИГ 3] Внутренний отступ для текста внутри прямоугольника */
        }
        .ojsc-calendar-header { display: flex; flex-direction: column; align-items: center; margin-bottom: 10px; gap: 10px; }
        .ojsc-calendar-navigation { display: flex; justify-content: center; align-items: center; }
        .ojsc-calendar-header select, .ojsc-calendar-header button { background-color: var(--background-modifier-form-field); color: var(--text-normal); border: 1px solid var(--background-modifier-border); border-radius: 4px; padding: 4px 8px; }
        .ojsc-calendar-navigation h2 { margin: 0 15px; text-transform: capitalize; color: white; text-align: center; }
        .ojsc-multi-month-header { text-align: center; text-transform: capitalize; margin-top: 20px; margin-bottom: 10px; }
    `;
    }
};