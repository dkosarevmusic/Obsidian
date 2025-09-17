```dataviewjs
// Путь к вашему скрипту. Убедитесь, что он указан от корня хранилища.
const SCRIPT_PATH = "JS Scripts/utility_Complition Checker_Table.js";

try {
    // Загружаем содержимое скрипта как текст с помощью dv.io.load
    const scriptText = await dv.io.load(SCRIPT_PATH);

    if (!scriptText) {
        throw new Error(`Файл скрипта пуст или не найден по пути: ${SCRIPT_PATH}`);
    }

    // Создаем и выполняем функцию из текста скрипта.
    const renderTableCompletion = new Function(scriptText)();

    if (typeof renderTableCompletion === 'function') {
        // Если все успешно, вызываем основную функцию
        await renderTableCompletion(dv, app);
    } else {
        throw new Error(`Скрипт не вернул функцию. Проверьте, что в конце файла '${SCRIPT_PATH}' есть 'return renderTableCompletion;'.`);
    }

} catch (e) {
    dv.paragraph(`⛔️ **Критическая ошибка:** Не удалось выполнить скрипт.\n**Сообщение:** ${e.message}`);
}

```