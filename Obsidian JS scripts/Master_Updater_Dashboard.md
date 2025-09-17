```dataviewjs
// --- MASTER UPDATER ---
// Этот скрипт принудительно обновит все заметки,
// использующие ваши кастомные скрипты-счетчики.
// Он будет перезапускаться автоматически, если это включено в настройках Dataview.

const SCRIPT_PATH = "JS Scripts/master_updater.js";

try {
    const scriptText = await dv.io.load(SCRIPT_PATH);
    const runUpdater = new Function(scriptText)();
    
    if (typeof runUpdater === 'function') {
        // dv.container - это DOM-элемент, в котором выполняется скрипт.
        // Передаем его, чтобы скрипт мог очистить логи и показать финальный отчет.
        await runUpdater(dv, app, dv.container);
    } else {
        throw new Error("Мастер-скрипт не вернул функцию.");
    }

} catch (e) {
    dv.paragraph(`⛔️ **Ошибка загрузки мастер-скрипта:** ${e.message}`);
    console.error(e);
}
```