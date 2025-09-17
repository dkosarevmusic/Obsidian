```dataviewjs
/**
 * --------------------------------------------------------------------------
 * Time KanBan - Main Script
 * --------------------------------------------------------------------------
 * Этот скрипт отображает задачи из папки "Life Manager/MDs" в виде канбан-доски,
 * сгруппированные по временным периодам (Сегодня, Неделя, Месяц и т.д.).
 *
 * Для удобства поддержки код разбит на модули:
 *  - JS Scripts/tkb/config.js: Настройки, константы и цветовые схемы.
 *  - JS Scripts/tkb/utils.js:  Вспомогательные функции (работа с датами, рендеринг).
 *  - JS Scripts/tkb/main.js:   Основная логика скрипта (фильтрация, сортировка, отображение).
 *
 * Скрипт сначала загружает эти модули, а затем выполняет основную логику
 * в файле main.js.
 */

/**
 * ─── SCRIPT LOADER ──────────────────────────────────────────────────────────
 * Загружает и выполняет внешние JS-файлы, чтобы основная логика работала
 * на всех устройствах (ПК и мобильные).
 */
const TKB = {}; // Namespace for all Kanban-related functions and variables

try {
    // Путь к папке со скриптами от корня хранилища.
    const SCRIPT_FOLDER = "JS Scripts/tkb";
    // Порядок важен: config -> utils -> main
    const SCRIPT_FILES = ["config.js", "utils.js", "main.js"];

    for (const fileName of SCRIPT_FILES) {
        const scriptContent = await dv.io.load(`${SCRIPT_FOLDER}/${fileName}`);
        if (!scriptContent) {
            throw new Error(`Файл скрипта пуст или не найден: ${fileName}`);
        }
        // Выполняем код модуля, передавая ему пространство имен TKB
        new Function('TKB', scriptContent)(TKB);
    }

    // Проверяем, что основная функция была определена в main.js
    if (typeof TKB.renderKanban !== 'function') {
        throw new Error("Основная функция TKB.renderKanban не была найдена. Проверьте файл JS Scripts/tkb/main.js.");
    }

    // Запускаем основную логику
    TKB.renderKanban(dv);

} catch (e) {
    // Выводим сообщение об ошибке прямо в заметке для удобной отладки
    dv.el("pre", `❌ **Ошибка выполнения Time KanBan.**\n\n${e.message}`);
    // Также выводим ошибку в консоль для более детального анализа
    console.error("Time KanBan Error:", e);
}

```