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
        /**
         * Нормализует поле (которое может быть строкой, ссылкой, массивом) в строку для сравнения.
         * @param {*} field - Поле для нормализации.
         * @param {boolean} isLink - Является ли поле ссылкой/массивом ссылок.
         * @returns {string}
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
            (() => {
                const aStatus = Array.isArray(a.status) ? a.status : [String(a.status)];
                const bStatus = Array.isArray(b.status) ? b.status : [String(b.status)];
                return (bStatus.includes('important') || false) - (aStatus.includes('important') || false);
            })() ||

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
            getComparableString(a.status).localeCompare(getComparableString(b.status)) ||
            getComparableString(a.Area).localeCompare(getComparableString(b.Area)) ||
            getComparableString(a.wikilinks, true).localeCompare(getComparableString(b.wikilinks, true)) ||

            // 4. По имени файла как последний критерий.
            a.file.name.localeCompare(b.file.name)
        );
     }
};