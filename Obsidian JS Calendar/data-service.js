/**
 * @file data-service.js
 * Функции для получения и обработки данных для календаря.
 */

if (!window.OJSC) window.OJSC = {};
if (!OJSC.services) OJSC.services = {};

// Инициализируем кеш в глобальном объекте
OJSC._cache = {
    tasks: null,
};

OJSC.services.data = {
    /**
     * Очищает внутренний кеш задач.
     */
    clearCache: () => {
        OJSC._cache.tasks = null;
    },

    /**
     * Получает ВСЕ задачи из Dataview и кеширует их.
     * @param {object} dv - Глобальный объект API Dataview.
     * @returns {Array<object>} - Массив всех страниц (задач).
     */
    getAllTasksFromDataview: (dv) => {
        if (OJSC._cache.tasks) {
            return OJSC._cache.tasks;
        }

        console.log("OJSC: Dataview query cache miss. Fetching tasks.");
        const source = OJSC.config.source;
        const dateField = OJSC.config.dateField;
        
        // Запрос стал проще: нам нужны все задачи, у которых просто есть дата.
        // Фильтрация по статусу будет происходить на клиенте.
        const tasks = dv.pages(source).where(p => p[dateField]).values;
        
        OJSC._cache.tasks = tasks; // Сохраняем в кеш
        return tasks;
    },

    /**
     * Получает задачи для определенного режима статусов, используя кеш.
     * @param {object} dv - Глобальный объект API Dataview.
     * @param {string} statusMode - Ключ режима статусов (например, 'work' или 'done').
     * @returns {Array<object>} - Массив отфильтрованных страниц (задач).
     */
    getTasks: (dv, statusMode) => {
        const allTasks = OJSC.services.data.getAllTasksFromDataview(dv);

        const statusField = OJSC.config.statusField;
        const allowedStatuses = OJSC.config.statusModes[statusMode]?.statuses || [];

        // Теперь мы фильтруем уже полученный (и закешированный) массив
        return allTasks.filter(p => {
            if (!p[statusField]) return false;
            const pageStatuses = Array.isArray(p[statusField]) ? p[statusField] : [p[statusField]];
            return pageStatuses.some(s => allowedStatuses.includes(s));
        });
    },

    /**
     * Группирует задачи по датам в формате 'yyyy-MM-dd'.
     * @param {Array<object>} tasks - Массив задач от Dataview.
     * @returns {object} - Объект, где ключи - это даты, а значения - массивы задач.
     */
    groupTasksByDate: (tasks) => {
        if (!Array.isArray(tasks)) return {};
        return tasks.reduce((acc, task) => {
            const dateField = task[OJSC.config.dateField];
            if (dateField) {
                const dateStr = OJSC.utils.date.format(dateField);
                if (!acc[dateStr]) acc[dateStr] = [];
                acc[dateStr].push(task);
            }
            return acc;
        }, {});
    }
};