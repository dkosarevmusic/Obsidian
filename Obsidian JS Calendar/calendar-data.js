/**
 * @file calendar-data.js
 * Функции для получения и обработки данных для календаря.
 */

if (!window.OJSC) window.OJSC = {};

OJSC.data = {
    /**
     * Получает задачи из хранилища на основе конфигурации.
     * @param {object} dv - Глобальный объект API Dataview.
     * @returns {Array<object>} - Массив страниц (задач).
     */
    getTasks: (dv) => {
        const source = OJSC.config.source;
        const dateField = OJSC.config.dateField;
        const statusField = OJSC.config.statusField;
        const allowedStatuses = OJSC.config.allowedStatuses;

        return dv.pages(source).where(p => {
            if (!p[dateField] || !p[statusField]) return false;
            const pageStatuses = Array.isArray(p[statusField]) ? p[statusField] : [p[statusField]];
            return pageStatuses.some(s => allowedStatuses.includes(s));
        }).values; // Преобразуем результат DataArray в обычный массив
    },

    /**
     * Группирует задачи по датам в формате 'yyyy-MM-dd'.
     * @param {Array<object>} tasks - Массив задач от Dataview.
     * @returns {object} - Объект, где ключи - это даты, а значения - массивы задач.
     */
    groupTasksByDate: (tasks) => {
        // Добавляем проверку: если tasks не является массивом, возвращаем пустой объект.
        if (!Array.isArray(tasks)) return {};
        return tasks.reduce((acc, task) => {
            const dateField = task[OJSC.config.dateField];
            if (dateField) {
                const dateStr = OJSC.utils.formatDate(dateField);
                if (!acc[dateStr]) acc[dateStr] = [];
                acc[dateStr].push(task);
            }
            return acc;
        }, {});
    }
};