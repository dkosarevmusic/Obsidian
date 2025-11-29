/**
 * Вспомогательные функции для календаря.
 */
OJSC.utils = {
     /**
      * Форматирует объект даты в строку YYYY-MM-DD.
      * @param {luxon.DateTime} luxonDate - Объект Luxon DateTime.
      * @returns {string} - Отформатированная строка.
      */
     formatDate: (luxonDate) => {
         if (!luxonDate || !luxonDate.isValid) return '';
         return luxonDate.toFormat('yyyy-MM-dd');
     }
};