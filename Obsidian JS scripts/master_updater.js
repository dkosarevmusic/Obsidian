async function runUpdater(dv, app, container) {
    // --- КОНФИГУРАЦИЯ ---
    // Список утилитарных скриптов, которые мы хотим принудительно обновлять.
    const SCRIPTS_TO_MANAGE = [
        "JS Scripts/utility_Complition Checker_Table.js",
        "JS Scripts/utility_Complition Checker_Project.js",
        "JS Scripts/utility_Complition Checker_Checkboxes.js"
    ];
    // Регулярное выражение для надежного извлечения пути к скрипту.
    const SCRIPT_PATH_REGEX = /const\s+SCRIPT_PATH\s*=\s*["'](.*?)["']/;

    // --- СОСТОЯНИЕ ---
    let totalFilesUpdated = 0;
    const errorFiles = [];

    // --- ОСНОВНАЯ ЛОГИКА ---
    try {
        // 1. Найти все файлы, которые используют один из отслеживаемых скриптов.
        // Для наглядности процесса будем выводить промежуточные шаги.
        container.innerHTML = '<h4>🚀 Запущено принудительное обновление...</h4>';
        dv.paragraph("🔍 Поиск файлов для обновления...");

        const allMdFiles = app.vault.getMarkdownFiles();
        const filesToUpdate = new Map(); // Используем Map: scriptPath -> [file1, file2, ...]

        for (const file of allMdFiles) {
            // Используем кэшированное чтение для скорости
            const content = await app.vault.cachedRead(file);
            if (!content.includes("dataviewjs")) continue;

            const match = content.match(SCRIPT_PATH_REGEX);
            if (match && SCRIPTS_TO_MANAGE.includes(match[1])) {
                const scriptPath = match[1];
                if (!filesToUpdate.has(scriptPath)) {
                    filesToUpdate.set(scriptPath, []);
                }
                filesToUpdate.get(scriptPath).push(file);
            }
        }

        if (filesToUpdate.size === 0) {
            dv.paragraph("✅ Не найдено файлов, использующих отслеживаемые скрипты. Все актуально.");
            return;
        }

        // 2. Обработать каждую группу файлов.
        for (const [scriptPath, targetFiles] of filesToUpdate.entries()) {
            dv.paragraph(`🔄 Обработка ${targetFiles.length} файлов для скрипта: \`${scriptPath}\``);

            // 2.1. Загрузить и скомпилировать утилитарную функцию.
            let renderFunction;
            try {
                const scriptText = await dv.io.load(scriptPath);
                renderFunction = new Function(scriptText)();
                if (typeof renderFunction !== 'function') throw new Error("Скрипт не вернул функцию.");
            } catch (e) {
                errorFiles.push({ path: scriptPath, error: `Не удалось загрузить/скомпилировать: ${e.message}` });
                continue; // Пропускаем группу, если сам скрипт сломан.
            }

            // 2.2. Подготовить "песочницу": сохраняем оригинальные функции dv и подменяем их пустышками.
            const originalDv = { current: dv.current, el: dv.el, paragraph: dv.paragraph, table: dv.table, list: dv.list };
            const noOp = () => {};
            Object.assign(dv, { el: noOp, paragraph: noOp, table: noOp, list: noOp });

            // 2.3. Обновить каждый целевой файл в этой группе.
            for (const targetFile of targetFiles) {
                try {
                    // ГЛАВНАЯ ХИТРОСТЬ: подменяем контекст, чтобы dv.current() указывал на нужный файл.
                    dv.current = () => dv.page(targetFile.path);
                    // Выполняем логику скрипта. Она обновит frontmatter, а весь вывод будет проигнорирован.
                    await renderFunction(dv, app);
                    totalFilesUpdated++;
                } catch (e) {
                    errorFiles.push({ path: targetFile.path, error: e.message });
                }
            }

            // 2.4. ОБЯЗАТЕЛЬНО: восстанавливаем оригинальные функции dv.
            Object.assign(dv, originalDv);
        }

        // 3. Финальный отчет.
        container.innerHTML = ''; // Очищаем промежуточные логи.
        const finishTime = new Date().toLocaleTimeString('ru-RU');

        dv.header(2, "Отчет об обновлении");
        dv.paragraph(`✅ **Обновление завершено.**`);
        dv.paragraph(`- **Время последнего обновления:** ${finishTime}`);
        dv.paragraph(`- **Всего обработано файлов:** ${totalFilesUpdated}`);

        if (errorFiles.length > 0) {
            dv.header(3, `❌ Обнаружены ошибки (${errorFiles.length})`);
            const errorRows = errorFiles.map(e => [`[[${e.path}]]`, `\`${e.error}\``]);
            dv.table(["Файл", "Ошибка"], errorRows);
        }

    } catch (e) {
        container.innerHTML = '';
        dv.el("pre", `❌ **Критическая ошибка в мастер-скрипте:**\n\n${e.stack}`);
    }
}

return runUpdater;