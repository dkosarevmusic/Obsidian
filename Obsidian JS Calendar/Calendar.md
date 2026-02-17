```dataviewjs
/**
 * --------------------------------------------------------------------------
 * Obsidian JS Calendar - Загрузчик
 * --------------------------------------------------------------------------
 * Этот скрипт отображает задачи из вашего хранилища в виде календаря.
 *
 * После рефакторинга код разбит на логические модули для удобства поддержки.
 * Все файлы находятся в папке "Obsidian JS Calendar".
 */

// Создаем глобальный объект, если его нет
if (!window.OJSC) window.OJSC = {};

try {
    const SCRIPT_FOLDER = "JS Scripts/cal";
    // Порядок важен: сначала утилиты и конфиг, потом сервисы и UI, в конце - главный файл.
    const SCRIPT_FILES = [
        "config.js",
        "date-utils.js", "task-utils.js",
        "data-service.js", "file-service.js",
        "state.js",
        "day-card-component.js", "month-grid-component.js", "header-component.js",
        "main.js"
    ];

    for (const fileName of SCRIPT_FILES) {
        const scriptContent = await dv.io.load(`${SCRIPT_FOLDER}/${fileName}`);
        if (!scriptContent) {
            throw new Error(`Файл скрипта пуст или не найден: ${fileName}`);
        }
        // Выполняем загруженный код
        new Function('OJSC', 'dv', 'luxon', scriptContent)(OJSC, dv, dv.luxon);
    }

    // --- ЗАПУСК КАЛЕНДАРЯ ---
    OJSC.renderCalendar(dv);

} catch (e) {
    // Если какой-то из файлов не найден, выводим понятную ошибку
    dv.el('div', `**Ошибка загрузки скриптов календаря.**
- Убедитесь, что все файлы находятся в правильных папках.
- Проверьте консоль разработчика (Ctrl+Shift+I) для получения подробной информации.
- Текст ошибки: \`${e.message}\``, {attr: {style: "color: red; font-family: monospace;"}});
    console.error("OJSC Calendar Load Error:", e);
}
```