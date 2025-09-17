async function renderTableCompletion(dv, app) {
    // --- КОНФИГУРАЦИЯ СТАТУСОВ ---
    const STATUSES = {
        'in progress': { key: 'inprogress', fmKey: 'tasksinprogress', emoji: '🚀', name: 'In progress' },
        'not started': { key: 'notstarted', fmKey: 'tasksnotstarted', emoji: '⏳', name: 'Not started' },
        'done':        { key: 'done',       fmKey: 'tasksdone',       emoji: '✅', name: 'Done' },
        'postpone':    { key: 'postpone',   fmKey: 'taskspostpone',   emoji: '⏸️', name: 'Postpone' },
        'cancelled':   { key: 'cancelled',  fmKey: 'taskscancelled',  emoji: '❌', name: 'Cancelled' }
    };
    const STATUS_KEY_MAP = Object.fromEntries(Object.entries(STATUSES).map(([name, conf]) => [name, conf.key]));
    const DISPLAY_ORDER = ['in progress', 'not started', 'done', 'postpone', 'cancelled'];

    // 1. ПОЛУЧЕНИЕ ДАННЫХ
    const curr = dv.current();
    if (!curr || !curr.file) {
        dv.paragraph("⛔️ Ошибка: Не удалось получить информацию о текущем файле.");
        return;
    }

    // Оптимизированный поиск: "лучшее из двух миров"
    // 1. Быстро получаем все входящие ссылки с помощью inlinks.
    // 2. Преобразуем их в страницы и фильтруем этот небольшой список, проверяя, что ссылка находится именно во frontmatter.
    const pages = dv.array(curr.file.inlinks.map(link => dv.page(link.path)))
        .where(p => {
            // Пропускаем "битые" ссылки и страницы без frontmatter
            if (!p || !p.file || !p.file.frontmatter) {
                return false;
            }

            // Итерация по КЛЮЧАМ frontmatter, чтобы получить доступ к ПАРСЕННЫМ Dataview значениям
            for (const key of Object.keys(p.file.frontmatter)) {
                // Получаем значение, которое Dataview уже обработал (например, превратил "[[...]]" в объект Link)
                const value = p[key];

                // Обрабатываем как одиночное значение, так и массив
                const links = Array.isArray(value) ? value : [value];
                
                // Ищем ссылку на текущий файл
                if (links.some(link => dv.value.isLink(link) && link.path === curr.file.path)) {
                    return true; // Нашли ссылку, включаем страницу в результат
                }
            }
            return false; // Ссылка на этот файл во frontmatter не найдена
        });

    // 2. ПОДСЧЕТ СТАТУСОВ (в один проход для скорости)
    const counts = Object.fromEntries(Object.values(STATUSES).map(s => [s.key, 0]));
    for (const p of pages) {
        // Если статус отсутствует, пуст или не является массивом, по умолчанию считаем его 'not started'
        const status = (p.status && Array.isArray(p.status) && p.status.length > 0)
            ? p.status[0].toLowerCase()
            : 'not started';

        const key = STATUS_KEY_MAP[status];
        if (key) counts[key]++;
    }

    // 3. РАСЧЕТ ИТОГОВ
    const totalLinks = pages.length;
    const doneCount = counts.done;
    const cancelledCount = counts.cancelled;
    const totalForProgress = totalLinks - cancelledCount;
    // Рассчитываем знаменатель для статусов, которые еще не завершены.
    // Это общее количество задач минус отмененные и завершенные.
    const totalRemaining = totalForProgress - doneCount;

    // 4. ОБНОВЛЕНИЕ FRONTMATTER (только при необходимости)
    const tfile = app.vault.getAbstractFileByPath(curr.file.path);
    if (tfile && !tfile.children) {
        const fm = curr.file.frontmatter || {};

        // --- НАСТРОЙКИ И ЛОГИКА COMPVIS ---
        const VISIBILITY_KEY = 'compvis';
        const isVisible = fm[VISIBILITY_KEY] !== false;
        
        const compKey = isVisible ? 'comp' : 'compx';
        const tasksKey = isVisible ? 'tasks' : 'tasksx';
        const oldCompKey = isVisible ? 'compx' : 'comp';
        const oldTasksKey = isVisible ? 'tasksx' : 'tasks';

        // --- ВЫЧИСЛЕНИЕ ЗНАЧЕНИЙ ---
        const newPctStr = totalForProgress > 0 ? `${Math.round((counts.done / totalForProgress) * 100)}%` : "0%";
        const newRatio = `${counts.done}/${totalForProgress || 0}`;

        // --- ФОРМИРОВАНИЕ ОБНОВЛЕНИЙ ---
        const updates = {};
        const deletions = [];

        // 4.1. Устанавливаем `compvis` по умолчанию, если его нет
        if (fm[VISIBILITY_KEY] === undefined) {
            updates[VISIBILITY_KEY] = true;
        }

        // 4.2. Обрабатываем поле `comp` / `compx`
        if (fm.hasOwnProperty(oldCompKey)) {
            deletions.push(oldCompKey);
        }
        if (fm[compKey] !== newPctStr || deletions.includes(oldCompKey)) {
            updates[compKey] = newPctStr;
        }

        // 4.3. Аналогично для поля `tasks` / `tasksx`
        if (fm.hasOwnProperty(oldTasksKey)) {
            deletions.push(oldTasksKey);
        }
        if (fm[tasksKey] !== newRatio || deletions.includes(oldTasksKey)) {
            updates[tasksKey] = newRatio;
        }
        
        // 4.4. Добавляем остальные ключи (статусы)
        const statusValues = Object.fromEntries(Object.values(STATUSES).map(s => [s.fmKey, counts[s.key]]));
        for (const key in statusValues) {
            if (fm[key] !== statusValues[key]) {
                updates[key] = statusValues[key];
            }
        }

        // 4.5. Применяем все изменения, если они есть
        if (Object.keys(updates).length > 0 || deletions.length > 0) {
            await app.fileManager.processFrontMatter(tfile, (frontmatter) => {
                Object.assign(frontmatter, updates);
                for (const key of deletions) {
                    delete frontmatter[key];
                }
            });
        }
    }

    // 5. ФОРМИРОВАНИЕ И ВЫВОД РЕЗУЛЬТАТА
    if (totalLinks === 0) {
        dv.paragraph("Нет связанных задач.");
    } else {
        // 5.1. Вывод общей сводки
        const completionPercentage = totalForProgress > 0 ? Math.round((counts.done / totalForProgress) * 100) : 0;
        dv.paragraph(`🎯 **Tasks**: ${counts.done}/${totalForProgress} &nbsp;&nbsp;&nbsp; 📈 **Completion**: ${completionPercentage}%`);
        
        // 5.2. Разделитель
        dv.paragraph('<hr />');

        // 5.3. Детальная статистика по статусам в виде таблицы для выравнивания
        const tableRows = [];
        // Добавляем стили, чтобы полностью скрыть ячейки и рамки таблицы, переопределяя стили темы
        const cellStyle = "border: none; background: transparent;";
        for (const statusName of DISPLAY_ORDER) {
            const statusInfo = STATUSES[statusName];
            const count = counts[statusInfo.key];

            if (count > 0) {
                // Ячейка со статусом. Добавляем отступ справа для разделения колонок.
                const statusCell = `<td style="${cellStyle} padding-right: 1em;">${statusInfo.emoji}&nbsp;${statusInfo.name}:</td>`;
                
                // Ячейка с прогрессом/количеством
                let progressCell;
                if (statusName === 'cancelled') {
                    progressCell = `<td style="${cellStyle}"><b>${count}</b></td>`;
                } else {
                    // Для незавершенных статусов ('in progress', 'not started', 'postpone') 
                    // в качестве знаменателя используем только оставшиеся задачи (без 'done' и 'cancelled').
                    // Для статуса 'done' используем общий знаменатель (без 'cancelled').
                    const isRemainingStatus = ['in progress', 'not started', 'postpone'].includes(statusName);
                    const denominator = isRemainingStatus ? totalRemaining : totalForProgress;

                    const progressTag = denominator > 0 
                        ? `<progress value="${count}" max="${denominator}"></progress>` 
                        : '';
                    // `vertical-align: middle` для выравнивания текста и прогресс-бара по центру
                    progressCell = `<td style="${cellStyle} vertical-align: middle;">${progressTag}&nbsp;<b>${count}/${denominator || 0}</b></td>`;
                }
                tableRows.push(`<tr>${statusCell}${progressCell}</tr>`);
            }
        }
        
        if (tableRows.length > 0) {
            // Убираем стандартные отступы и рамки таблицы для более чистого вида.
            const tableHtml = `<table style="border-spacing: 0; border-collapse: collapse; border: none;"><tbody>${tableRows.join('')}</tbody></table>`;
            dv.el('div', tableHtml);
        } else if (totalLinks > 0) { // Если есть связанные страницы, но ни одна не попала в статистику
            dv.paragraph("Все связанные задачи имеют неизвестный статус.");
        }

        // Финальный разделитель
        dv.paragraph('<hr />');
    }
}

return renderTableCompletion;