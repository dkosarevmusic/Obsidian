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

OJSC.ui.createDayCard = (dayDate, tasksByDate, viewType, dv, onTaskDrop, onBulkTaskDrop, statusMode, showTime, showParticipants, showWikilinks) => {
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

    // --- Логика массовых операций (перемещение) ---
    card.addEventListener('click', (e) => {
        if (OJSC.state.bulkMode && OJSC.state.selectedTasks.length > 0) {
            e.preventDefault();
            e.stopPropagation();
            const newDate = card.dataset.date;
            if (!newDate) return;
            const scroller = card.closest('.cm-scroller, .markdown-preview-view');
            if (scroller) {
                OJSC.state.setScrollPosition(scroller.scrollTop);
            }
            const targetTaskList = card.querySelector('.ojsc-task-list');
            if (targetTaskList) {
                OJSC.state.selectedTasks.forEach(task => {
                    const el = document.querySelector(`.ojsc-task-item[data-file-path="${CSS.escape(task.file.path)}"]`);
                    if (el) {
                        el.classList.remove('ojsc-task-item-selected');
                        el.classList.add('ojsc-task-item-saving');
                        targetTaskList.appendChild(el);
                    }
                });
            }
            onBulkTaskDrop(OJSC.state.selectedTasks, newDate);
            OJSC.state.setBulkMode(false);
            document.querySelector('.ojsc-container')?.classList.remove('ojsc-bulk-mode');
            document.querySelector('.ojsc-bulk-mode-btn')?.classList.remove('active');
        }
    });

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
        element.classList.remove('ojsc-dragging');
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
        header.onclick = (e) => {
            if (OJSC.state.bulkMode) return;
            OJSC.state.setPreviousView(viewType);
            OJSC.renderCalendar(dv, dayDate, '1day', statusMode);
        };
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

    // --- Рендеринг списка задач ---
    if (dayTasks.length > 0) {
        dayTasks.sort(OJSC.utils.task.compare).forEach(task => {
            const li = document.createElement('li');
            li.className = 'ojsc-task-item';
            li.dataset.filePath = task.file.path;
            li.setAttribute('draggable', 'true');

            // Восстанавливаем состояние выделения при перерисовке
            if (OJSC.state.bulkMode && OJSC.state.selectedTasks.some(t => t.file.path === task.file.path)) {
                li.classList.add('ojsc-task-item-selected');
            }

            const link = document.createElement('a');
            link.className = 'internal-link';
            link.href = task.file.path;

            if (task.time && (viewType === '1day' || showTime)) {
                li.classList.add('ojsc-task-with-time');
                const timeSpan = document.createElement('span');
                timeSpan.className = 'ojsc-task-time';
                timeSpan.textContent = OJSC.utils.task.formatTime(task.time);
                link.appendChild(timeSpan);
            }

            const textSpan = document.createElement('span');
            textSpan.className = 'ojsc-task-text';
            textSpan.textContent = task[OJSC.config.summaryField] || task.file.name;
            link.appendChild(textSpan);

            const taskStatus = Array.isArray(task.status) ? task.status : [String(task.status)];
            const isImportant = taskStatus.includes('important');
            const area = Array.isArray(task.Area) ? task.Area[0] : task.Area;

            if (isImportant && !area) {
                li.classList.add('ojsc-task-important-no-area');
            } else {
                if (area) {
                    // Добавляем класс для каждой Area, чтобы можно было стилизовать в CSS
                    li.classList.add(`ojsc-area-${area.replace(/\s+/g, '-')}`);
                }
                if (isImportant) {
                    li.classList.add('ojsc-task-item-important');
                }
            }

            li.appendChild(link);

            if (task.participants && (viewType === '1day' || showParticipants)) {
                const participantsDiv = document.createElement('div');
                participantsDiv.className = 'ojsc-task-participants';
                
                const participants = Array.isArray(task.participants) ? task.participants : [task.participants];
                participants.forEach(p => {
                    if (!p || !p.path) return; // Add guard clause for invalid participant data
                    const participantLink = document.createElement('a');
                    participantLink.className = 'internal-link';
                    participantLink.href = p.path;
                    // Use display name if available, otherwise fallback to path
                    participantLink.textContent = p.display || p.path.split('/').pop().replace('.md', '');
                    participantsDiv.appendChild(participantLink);
                });
                li.appendChild(participantsDiv);
            }

            if (task.wikilinks && (viewType === '1day' || showWikilinks)) {
                const wikilinksDiv = document.createElement('div');
                wikilinksDiv.className = 'ojsc-task-wikilinks';

                const wikilinks = Array.isArray(task.wikilinks) ? task.wikilinks : [task.wikilinks];
                wikilinks.forEach(p => {
                    if (!p || !p.path) return; // Add guard clause for invalid participant data
                    const wikilinkLink = document.createElement('a');
                    wikilinkLink.className = 'internal-link';
                    wikilinkLink.href = p.path;
                    // Use display name if available, otherwise fallback to path
                    wikilinkLink.textContent = p.display || p.path.split('/').pop().replace('.md', '');
                    wikilinksDiv.appendChild(wikilinkLink);
                });
                li.appendChild(wikilinksDiv);
            }
            taskList.appendChild(li);
        });
    }

    // --- Делегирование событий ---
    // Клик для массового выделения
    taskList.addEventListener('click', (e) => {
        if (!OJSC.state.bulkMode) return;
        const li = e.target.closest('.ojsc-task-item');
        if (!li) return;
        e.preventDefault();
        e.stopPropagation();

        const filePath = li.dataset.filePath;
        const task = dayTasks.find(t => t.file.path === filePath);
        if (!task) return;

        let currentSelectedTasks = OJSC.state.selectedTasks;
        const isSelected = currentSelectedTasks.some(t => t.file.path === filePath);

        if (isSelected) {
            currentSelectedTasks = currentSelectedTasks.filter(t => t.file.path !== filePath);
            li.classList.remove('ojsc-task-item-selected');
        } else {
            currentSelectedTasks.push(task);
            li.classList.add('ojsc-task-item-selected');
        }
        OJSC.state.setSelectedTasks(currentSelectedTasks);
    });

    // Drag and Drop для мыши
    taskList.addEventListener('dragstart', (e) => {
        if (OJSC.state.bulkMode) {
            e.preventDefault();
            return;
        }
        const li = e.target.closest('.ojsc-task-item');
        if (!li) return;
        const task = dayTasks.find(t => t.file.path === li.dataset.filePath);
        if (!task) return;
        window.OJSC.dragContext = { element: li, task: task, oldDateKey: dayKey };
    });

    taskList.addEventListener('dragend', () => {
        window.OJSC.dragContext = {};
    });

    // Drag and Drop для тач-устройств
    let touchTimer = null;
    let lastTouchTarget = null;

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
    
    const cancelTouchTimer = () => {
        if (touchTimer) {
            clearTimeout(touchTimer);
            touchTimer = null;
        }
    };

    taskList.addEventListener('touchstart', (e) => {
        const li = e.target.closest('.ojsc-task-item');
        if (!li) return;
        e.stopPropagation();
        touchTimer = setTimeout(() => {
            const task = dayTasks.find(t => t.file.path === li.dataset.filePath);
            if (!task) return;
            window.OJSC.dragContext = { element: li, task: task, oldDateKey: dayKey };
            li.classList.add('ojsc-dragging');
            document.addEventListener('touchmove', handleGlobalTouchMove, { passive: false });
            document.addEventListener('touchend', handleGlobalTouchEnd);
        }, 500);
    });
    
    taskList.addEventListener('touchmove', cancelTouchTimer);
    taskList.addEventListener('touchend', cancelTouchTimer);

    card.appendChild(taskList);
    return card;
};