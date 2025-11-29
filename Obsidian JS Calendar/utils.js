/**
 * Вспомогательные функции для календаря.
 */
OJSC.utils = {
     /**
      * Форматирует объект даты в строку YYYY-MM-DD.
      * @param {Date} date - Объект даты.
      * @returns {string} - Отформатированная строка.
      */
     formatDate: (date) => {
         if (!date) return '';
         // toISOString() возвращает UTC, toLocaleDateString может дать не тот формат.
         // Этот способ надежен для получения локальной даты в нужном формате.
         return new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
     }
};