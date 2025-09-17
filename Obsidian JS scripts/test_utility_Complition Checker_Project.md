```dataviewjs
// --- АЛЬТЕРНАТИВНЫЙ МЕТОД (если dv.io.script не работает) ---

// Путь к вашему скрипту. Убедитесь, что он указан от корня хранилища.
const SCRIPT_PATH = "JS Scripts/test_utility_Complition Checker_Project.js";

try {
    // Загружаем содержимое скрипта как текст с помощью dv.io.load
    const scriptText = await dv.io.load(SCRIPT_PATH);

    if (!scriptText) {
        throw new Error(`Файл скрипта пуст или не найден по пути: ${SCRIPT_PATH}`);
    }

    // Создаем и выполняем функцию из текста скрипта.
    // Это позволяет получить возвращаемое значение (нашу функцию renderProjectCompletion).
    const renderProjectCompletion = new Function(scriptText)();

    if (typeof renderProjectCompletion === 'function') {
        // Если все успешно, вызываем основную функцию
        await renderProjectCompletion(dv, app);
    } else {
        throw new Error(`Скрипт не вернул функцию. Проверьте, что в конце файла '${SCRIPT_PATH}' есть 'return renderProjectCompletion;'.`);
    }

} catch (e) {
    dv.paragraph(`⛔️ **Критическая ошибка:** Не удалось выполнить скрипт.
**Сообщение:** ${e.message}`);
}
```