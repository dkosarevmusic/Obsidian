/**
 * @file day-card-component.js
 * Компонент для создания карточки одного дня с задачами.
 */
if (!window.OJSC) window.OJSC = {};
if (!OJSC.ui) OJSC.ui = {};

/**
 * Определяет класс CSS для карточки дня на основе приоритета задач.
 * Приоритет: Work > Skills > Art.
 * @param {Array} tasks - Массив задач для данного дня.
 * @returns {string} - Имя класса CSS или пустая строка.
 */
const getDayTaskClass = (tasks) => {
    if (!tasks || tasks.length === 0) return '';

    const areas = new Set(tasks.map(t => t.Area).flat().filter(Boolean));

    if (areas.has('Work')) return 'ojsc-day-work';
    if (areas.has('Skills')) return 'ojsc-day-skills';
    if (areas.has('Art')) return 'ojsc-day-art';

    return '';
};

OJSC.ui.createDayCard = (dayDate, tasksByDate, viewType, dv, onTaskDrop, statusMode) => {
    const dayKey = dayDate.toISODate();
    const dayTasks = tasksByDate[dayKey] || [];

    if (!window.OJSC.dragContext) window.OJSC.dragContext = {};

    const card = document.createElement('div');
    card.className = 'ojsc-day-card';
    card.dataset.date = dayKey;
    if (dayDate.toISODate() === luxon.DateTime.now().toISODate()) {
        card.classList.add('ojsc-today');
    }

    const dayTaskClass = getDayTaskClass(dayTasks);
    if (dayTaskClass) {
        card.classList.add(dayTaskClass);
    }

    // --- Логика Drag-and-Drop (Drop Zone) ---
    card.addEventListener('dragover', (e) => {
        e.preventDefault();
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

        // Принудительно убираем класс 'ojsc-dragging' и его opacity,
        // чтобы анимация вспышки была яркой и консистентной на всех устройствах.
        element.classList.remove('ojsc-dragging');

        // Добавляем класс для визуальной индикации процесса сохранения.
        // Класс будет активен до полной перерисовки календаря.
        element.classList.add('ojsc-task-item-saving');

        const targetTaskList = card.querySelector('.ojsc-task-list');
        if (targetTaskList) targetTaskList.appendChild(element);

        const newDate = dayDate.toISODate();
        onTaskDrop(task.file.path, newDate, task, oldDateKey);
    });

    const header = document.createElement('div');
    header.className = 'ojsc-day-card-header';

    if (['month', '3months', 'year'].includes(viewType)) {
        header.classList.add('ojsc-clickable-day');
        header.onclick = () => {
            OJSC.state.setPreviousView(viewType);
            OJSC.renderCalendar(dv, dayDate, '1day', statusMode);
        };

        // Всегда отображаем номер дня для сеточных видов
        const daySpan = document.createElement('span');
        daySpan.textContent = dayDate.day;
        if (dayDate.hasSame(luxon.DateTime.now(), 'day')) daySpan.classList.add('ojsc-today-number');
        header.appendChild(daySpan);
    }

    if (viewType === '1day') {
        let headerText = dayDate.setLocale('ru').toFormat('cccc, d.MM.yyyy');
        header.textContent = headerText.charAt(0).toUpperCase() + headerText.slice(1);
        header.style.textAlign = 'left';
    }

    card.appendChild(header);

    const taskList = document.createElement('ul');
    taskList.className = 'ojsc-task-list';

    if (dayTasks.length > 0) {
        let lastTouchTarget = null;

        // Эти функции не зависят от конкретной задачи, их можно определить один раз.
        const handleGlobalTouchMove = (e) => {
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
    
        const handleGlobalTouchEnd = (e) => {
            document.removeEventListener('touchmove', handleGlobalTouchMove);
            document.removeEventListener('touchend', handleGlobalTouchEnd);
    
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

        dayTasks.sort(OJSC.utils.task.compare).forEach(task => {
            let touchTimer = null;
            const cancelTimer = () => {
                if (touchTimer) {
                    clearTimeout(touchTimer);
                    touchTimer = null;
                }
            };

            const li = document.createElement('li');
            li.className = 'ojsc-task-item';
            li.setAttribute('draggable', 'true');

            li.addEventListener('dragstart', (e) => {
                window.OJSC.dragContext = { element: li, task: task, oldDateKey: dayKey };
            });

            // Очищаем контекст после завершения перетаскивания мышью.
            // Это решает проблему "залипания" элемента.
            li.addEventListener('dragend', () => {
                window.OJSC.dragContext = {};
            });

            li.addEventListener('touchstart', (e) => {
                e.stopPropagation();
                touchTimer = setTimeout(() => {
                    window.OJSC.dragContext = { element: li, task: task, oldDateKey: dayKey };
                    li.classList.add('ojsc-dragging');
                    document.addEventListener('touchmove', handleGlobalTouchMove, { passive: false });
                    document.addEventListener('touchend', handleGlobalTouchEnd);
                }, 500);
            });

            li.addEventListener('touchmove', cancelTimer);
            li.addEventListener('touchend', cancelTimer);

            const link = document.createElement('a');

            const taskStatus = Array.isArray(task.status) ? task.status : [String(task.status)];
            const isImportant = taskStatus.includes('important');
            const hasArea = !!task.Area;

            if (isImportant && !hasArea) {
                li.style.backgroundColor = 'hsla(0, 80%, 50%, 0.2)';
                li.style.borderLeft = '3px solid hsl(0, 80%, 50%)';
                link.style.color = 'hsl(0, 80%, 75%)';
            } else {
                if (hasArea) {
                    const styles = OJSC.utils.task.getStyles(task.Area || '');
                    li.style.backgroundColor = styles.backgroundColor;
                    li.style.borderLeft = `3px solid ${styles.borderColor}`;
                    link.style.color = styles.color;
                }
                if (isImportant) li.classList.add('ojsc-task-item-important');
            }

            link.textContent = task[OJSC.config.summaryField] || task.file.name;
            link.className = 'internal-link';
            link.href = task.file.path;
            li.appendChild(link);
            taskList.appendChild(li);
        });
    }

    card.appendChild(taskList);
    return card;
};