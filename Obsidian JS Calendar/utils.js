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
     },

     /**
      * Генерирует стили для элемента задачи на основе цвета области (Area).
      * @param {string} area - Название области задачи.
      * @returns {{backgroundColor: string, color: string, borderColor: string}}
      */
     getTaskStyles: (area) => {
        const colorMap = OJSC.config.areaColors;
        const hslColor = colorMap[area] || 'hsl(0,0%,80%)'; // Цвет по умолчанию
        return {
            backgroundColor: hslColor.replace('hsl(', 'hsla(').replace(')', ',0.2)'), // Полупрозрачный фон
            color: hslColor,
            borderColor: hslColor
        };
     }
};