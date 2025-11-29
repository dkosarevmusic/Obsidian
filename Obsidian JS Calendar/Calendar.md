```dataviewjs
/**
 * --------------------------------------------------------------------------
 * Obsidian JS Calendar - Loader
 * --------------------------------------------------------------------------
 * Этот скрипт отображает задачи из вашего хранилища в виде календаря.
 *
 * Для удобства поддержки код разбит на модули:
 *  - config.js: Настройки и константы.
 *  - utils.js:  Вспомогательные функции (работа с датами, рендеринг).
 *  - main.js:   Основная логика скрипта (получение данных, отображение).
 *
 * Все файлы должны находиться в папке "Obsidian JS Calendar" в корне хранилища.
 */

/**
 * ─── SCRIPT LOADER ──────────────────────────────────────────────────────────
 * Загружает и выполняет внешние JS-файлы.
 */
const OJSC = {}; // Namespace для всех функций и переменных календаря

try {
    const luxon = dv.luxon; // Получаем luxon из API Dataview
    // Путь к папке со скриптами от корня хранилища.
    const SCRIPT_FOLDER = "JS Scripts/cal";
    // Порядок важен: config -> utils -> main
    const SCRIPT_FILES = ["config.js", "utils.js", "main.js"];

    for (const fileName of SCRIPT_FILES) {
        const scriptContent = await dv.io.load(`${SCRIPT_FOLDER}/${fileName}`);
        if (!scriptContent) {
            throw new Error(`Файл скрипта пуст или не найден: ${fileName}`);
        }
        // Выполняем код модуля, передавая ему пространство имен OJSC, объект dv и библиотеку luxon
        new Function('OJSC', 'dv', 'luxon', scriptContent)(OJSC, dv, luxon);
    }

    // Проверяем, что основная функция была определена в main.js
    if (typeof OJSC.renderCalendar !== 'function') {
        throw new Error("Основная функция OJSC.renderCalendar не была найдена. Проверьте файл JS Scripts/cal/main.js.");
    }

    // Запускаем основную логику
    OJSC.renderCalendar(dv);

} catch (e) {
    // Выводим сообщение об ошибке прямо в заметке для удобной отладки
    dv.el("pre", `❌ **Ошибка выполнения JS Calendar.**\n\n**Сообщение:** ${e.message}\n\n**Стек:**\n${e.stack}`);
    console.error("JS Calendar Error:", e);
}
```