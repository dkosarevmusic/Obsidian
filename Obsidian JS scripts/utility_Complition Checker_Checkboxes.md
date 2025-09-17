```dataviewjs
// Путь к вашему скрипту. Убедитесь, что он указан от корня хранилища.
const SCRIPT_PATH = "JS Scripts/utility_Complition Checker_Checkboxes.js";

try {
    // Загружаем содержимое скрипта как текст с помощью dv.io.load
    const scriptText = await dv.io.load(SCRIPT_PATH);

    if (!scriptText) {
        throw new Error(`Файл скрипта пуст или не найден по пути: ${SCRIPT_PATH}`);
    }

    // Создаем и выполняем функцию из текста скрипта.
    // Это позволяет получить возвращаемое значение (нашу функцию renderCheckboxCompletion).
    const renderCheckboxCompletion = new Function(scriptText)();

    if (typeof renderCheckboxCompletion === 'function') {
        // Если все успешно, вызываем основную функцию
        await renderCheckboxCompletion(dv, app);
    } else {
        throw new Error(`Скрипт не вернул функцию. Проверьте, что в конце файла '${SCRIPT_PATH}' есть 'return renderCheckboxCompletion;'.`);
    }

} catch (e) {
    dv.paragraph(`⛔️ **Критическая ошибка:** Не удалось выполнить скрипт.
**Сообщение:** ${e.message}`);
}
```