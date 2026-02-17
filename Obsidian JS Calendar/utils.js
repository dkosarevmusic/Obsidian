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
     * @param {string} viewType - Текущий тип вида ('month', 'year' и т.д.).
     * @param {object} dv - Глобальный объект API Dataview для перерисовки.
     * @param {function} onTaskDrop - Callback-функция, вызываемая при переносе задачи.
     * @returns {HTMLElement} - HTML-элемент карточки дня.
     */
    createDayCard: (dayDate, tasksByDate, viewType, dv, onTaskDrop) => {
        const dayKey = dayDate.toISODate();
        const dayTasks = tasksByDate[dayKey] || [];

        // Глобальная переменная для хранения перетаскиваемого элемента и его данных
        if (!window.OJSC.dragContext) window.OJSC.dragContext = {};

        const card = document.createElement('div');
        card.className = 'ojsc-day-card';
        card.dataset.date = dayKey; // Добавляем data-атрибут с датой для мобильного drag-n-drop
        if (dayDate.toISODate() === luxon.DateTime.now().toISODate()) {
            card.classList.add('ojsc-today');
        }

        // --- Логика Drag-and-Drop (Drop Zone) ---
        card.addEventListener('dragover', (e) => {
            e.preventDefault(); // Необходимо, чтобы разрешить drop
            card.classList.add('ojsc-drop-target');
        });
        card.addEventListener('dragleave', () => {
            card.classList.remove('ojsc-drop-target');
        });
        card.addEventListener('drop', (e) => {
            e.preventDefault();
            card.classList.remove('ojsc-drop-target');
            const { element, task, oldDateKey } = window.OJSC.dragContext;
            if (!element || !task) return;

            // Оптимистичное обновление UI: перемещаем DOM-элемент
            const targetTaskList = card.querySelector('.ojsc-task-list');
            if (targetTaskList) targetTaskList.appendChild(element);

            // Вызываем callback для обновления файла и локальных данных
            const newDate = dayDate.toISODate();
            onTaskDrop(task.file.path, newDate, task, oldDateKey);
        });

        const header = document.createElement('div');
        header.className = 'ojsc-day-card-header';

        // Добавляем обработчик для "проваливания" в день
        if (['month', '3months', 'year'].includes(viewType)) {
            header.classList.add('ojsc-clickable-day');
            header.onclick = () => {
                localStorage.setItem('ojsc_previousView', viewType);
                OJSC.renderCalendar(dv, dayDate, '1day');
            };
        }

        const daySpan = document.createElement('span');
        if (viewType === '1day') {
            let headerText = dayDate.setLocale('ru').toFormat('cccc, d.MM.yyyy');
            header.textContent = headerText.charAt(0).toUpperCase() + headerText.slice(1);
            header.style.textAlign = 'left';
        }

        card.appendChild(header); 

        const taskList = document.createElement('ul');
        taskList.className = 'ojsc-task-list';

        if (dayTasks.length > 0) {
            // --- НАЧАЛО: НОВАЯ, ИСПРАВЛЕННАЯ ЛОГИКА ДЛЯ МОБИЛЬНОГО DRAG-AND-DROP ---

            let touchTimer = null;
            let lastTouchTarget = null;

            // Обработчик движения пальца (только во время активного переноса)
            const handleTouchMove = (e) => {
                e.preventDefault();
                if (!window.OJSC.dragContext.element) return;

                const touch = e.touches[0];
                const target = document.elementFromPoint(touch.clientX, touch.clientY);
                const dropZone = target ? target.closest('.ojsc-day-card') : null;

                if (lastTouchTarget && lastTouchTarget !== dropZone) {
                    lastTouchTarget.classList.remove('ojsc-drop-target');
                }
                if (dropZone) dropZone.classList.add('ojsc-drop-target');
                lastTouchTarget = dropZone;
            };

            // Обработчик отпускания пальца (завершение переноса)
            const handleTouchEnd = (e) => {
                document.removeEventListener('touchmove', handleTouchMove);
                document.removeEventListener('touchend', handleTouchEnd);

                if (window.OJSC.dragContext.element) {
                    const { element, task, oldDateKey } = window.OJSC.dragContext;
                    element.classList.remove('ojsc-dragging');

                    if (lastTouchTarget) {
                        lastTouchTarget.classList.remove('ojsc-drop-target');
                        const newDate = lastTouchTarget.dataset.date;
                        const targetTaskList = lastTouchTarget.querySelector('.ojsc-task-list');
                        if (targetTaskList) {
                            targetTaskList.appendChild(element);
                            onTaskDrop(task.file.path, newDate, task, oldDateKey);
                        }
                    }
                }

                window.OJSC.dragContext = {};
                lastTouchTarget = null;
            };

            // Функция для отмены таймера. Используется, если пользователь начал скролл.
            const cancelTimer = () => {
                if (touchTimer) {
                    clearTimeout(touchTimer);
                    touchTimer = null;
                }
            };

            // Привязываем отмену таймера к событиям движения и отпускания пальца НА ВСЕЙ КАРТОЧКЕ ДНЯ.
            // Это ключевое исправление: теперь скролл в любом месте карточки отменит перенос.
            card.addEventListener('touchmove', cancelTimer);
            card.addEventListener('touchend', cancelTimer);

            // --- КОНЕЦ: НОВАЯ ЛОГИКА ---

            dayTasks.sort(OJSC.utils.compareTasks).forEach(task => {
                const li = document.createElement('li');
                li.className = 'ojsc-task-item';
                li.setAttribute('draggable', 'true');

                // Desktop Drag-and-Drop
                li.addEventListener('dragstart', (e) => {
                    window.OJSC.dragContext = { element: li, task: task, oldDateKey: dayKey };
                });

                // Mobile Drag-and-Drop (только начало)
                li.addEventListener('touchstart', (e) => {
                    // Предотвращаем "всплытие" события, чтобы не сработал cancelTimer на карточке.
                    e.stopPropagation();

                    touchTimer = setTimeout(() => {
                        window.OJSC.dragContext = { element: li, task: task, oldDateKey: dayKey };
                        li.classList.add('ojsc-dragging');
                        document.addEventListener('touchmove', handleTouchMove, { passive: false });
                        document.addEventListener('touchend', handleTouchEnd);
                    }, 500);
                });

                const link = document.createElement('a');

                const taskStatus = Array.isArray(task.status) ? task.status : [String(task.status)];
                const isImportant = taskStatus.includes('important');
                const hasArea = !!task.Area;

                if (isImportant && !hasArea) {
                    // Важная задача БЕЗ Area -> полностью красная
                    li.style.backgroundColor = 'hsla(0, 80%, 50%, 0.2)';
                    li.style.borderLeft = '3px solid hsl(0, 80%, 50%)';
                    link.style.color = 'hsl(0, 80%, 75%)';
                } else {
                    // Применяем стили Area, если они есть
                    if (hasArea) {
                    const styles = OJSC.utils.getTaskStyles(task.Area || '');
                    li.style.backgroundColor = styles.backgroundColor;
                    li.style.borderLeft = `3px solid ${styles.borderColor}`;
                    link.style.color = styles.color;
                    }
                    // Если задача важная (и имеет Area), добавляем класс для подсветки
                    if (isImportant) li.classList.add('ojsc-task-item-important');
                }

                link.textContent = task[OJSC.config.summaryField] || task.file.name;
                link.className = 'internal-link';
                link.href = task.file.path;
                li.appendChild(link);
                taskList.appendChild(li);
            });
        } else if (viewType !== '1day') {
            // Для видов 'month', '3months', 'year' добавляем номер дня в заголовок
            const daySpan = document.createElement('span');
            daySpan.textContent = dayDate.day;
            if (dayDate.hasSame(luxon.DateTime.now(), 'day')) daySpan.classList.add('ojsc-today-number');
            header.appendChild(daySpan);
        }

        card.appendChild(taskList);
        return card;
    },

    /**
     * Создает и возвращает HTML-элемент для сетки одного месяца.
     * @param {luxon.DateTime} monthDate - Дата, определяющая отображаемый месяц.
     * @param {object} tasksByDate - Сгруппированные задачи.
     * @param {string} viewType - Текущий тип вида.
     * @param {object} dv - Глобальный объект API Dataview.
     * @param {function} onTaskDrop - Callback-функция для обновления задачи.
     * @returns {HTMLElement} - Элемент `<div>` для одного месяца.
     */
    createMonthGrid: (monthDate, tasksByDate, viewType, dv, onTaskDrop) => {
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
            const card = OJSC.utils.createDayCard(currentDay, tasksByDate, viewType, dv, onTaskDrop);
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
        .ojsc-button-group { display: flex; gap: 5px; flex-shrink: 0; }
        .ojsc-main-nav-group { display: flex; gap: 5px; }
        .ojsc-calendar-header select, .ojsc-calendar-header button { background-color: var(--background-modifier-form-field); color: var(--text-normal); border: 1px solid var(--background-modifier-border); border-radius: 4px; padding: 4px 8px; }
        .ojsc-calendar-header select {
            text-align: center;
            text-align-last: center;
        }
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
        .ojsc-day-card.ojsc-drop-target {
            background-color: var(--background-modifier-hover);
            border-style: dashed;
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
        /* Стиль для элемента, который перетаскивается на мобильных */
        .ojsc-task-item.ojsc-dragging {
            opacity: 0.5;
            border-style: dashed;
        }
        /* Стиль для подсветки "важных" задач. Накладывается поверх цвета Area. */
        .ojsc-task-item.ojsc-task-item-important {
            /* Добавляем красную рамку справа, чтобы не конфликтовать с рамкой Area слева */
            box-shadow: inset -3px 0 0 hsl(0, 80%, 50%);
            /* Можно добавить и полупрозрачный фон, если нужно более сильное выделение */
            /* background-image: linear-gradient(to right, hsla(0, 80%, 50%, 0.1), hsla(0, 80%, 50%, 0.1)); */
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
        .ojsc-clickable-day {
            cursor: pointer;
            transition: background-color 0.2s ease-in-out;
            border-radius: 4px;
            background-color: var(--background-modifier-form-field); /* Постоянное выделение */
            margin: -2px; /* Компенсируем padding родителя, чтобы ховер был красивее */
            padding: 2px; /* Возвращаем внутренний отступ */
        }
        .ojsc-clickable-day:hover {
            background-color: var(--background-modifier-hover);
        }

        /* --- Кастомные сдвиги для разных режимов --- */
        /* Для месячного вида, компенсируем padding: 4px у .ojsc-month-grid-card */
        .ojsc-month-grid .ojsc-task-item {
            margin-left: 2px; /* Сдвиг вправо на 1px */
        }

        /* --- Адаптивность для мобильных устройств --- */
        @media (max-width: 650px) {
            .ojsc-calendar-header {
                flex-direction: column; /* Элементы в столбец */
                align-items: center; /* Центрируем элементы по горизонтали */
            }
            .ojsc-calendar-header h2 {
                position: static; /* Убираем абсолютное позиционирование */
                transform: none; /* Сбрасываем трансформацию */
                order: 2; /* Ставим заголовок вторым */
                margin-bottom: 8px; /* Добавляем отступ снизу */
            }
            .ojsc-button-group {
                justify-content: center; /* Центрируем кнопки */
                order: 3; /* Ставим кнопки управления третьими */
                flex-direction: column; /* Ставим кнопки в столбец */
                align-items: stretch; /* Растягиваем кнопки на всю ширину */
            }
            .ojsc-main-nav-group {
                display: flex;
                justify-content: space-between; /* Распределяем кнопки по ширине */
                gap: 5px; /* Добавляем отступ между кнопками */
            }
            .ojsc-main-nav-group button {
                flex-grow: 1; /* Позволяем кнопкам расти */
            }
            .ojsc-calendar-header select {
                order: 1; /* Ставим выбор режима первым */
                margin-bottom: 8px; /* Добавляем отступ снизу */
            }
        }
    `;
    }
};