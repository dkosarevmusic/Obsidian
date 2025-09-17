async function renderProjectCompletion(dv, app) {
    // --- КОНФИГУРАЦИЯ СТАТУСОВ ---
    // Единый центр управления статусами, их отображением и ключами в frontmatter.
    const STATUSES = {
        'in progress': { key: 'inprogress', fmKey: 'tasksinprogress', emoji: '🚀', name: 'In progress' },
        'not started': { key: 'notstarted', fmKey: 'tasksnotstarted', emoji: '⏳', name: 'Not started' },
        'done':        { key: 'done',       fmKey: 'tasksdone',       emoji: '✅', name: 'Done' },
        'postpone':    { key: 'postpone',   fmKey: 'taskspostpone',   emoji: '⏸️', name: 'Postpone' },
        'cancelled':   { key: 'cancelled',  fmKey: 'taskscancelled',  emoji: '❌', name: 'Cancelled' }
    };
    // Порядок, в котором статусы будут отображаться в итоговой таблице.
    const DISPLAY_ORDER = ['in progress', 'not started', 'done', 'postpone', 'cancelled'];

    // --- ОСНОВНАЯ ЛОГИКА ---

    // 1. ПОЛУЧЕНИЕ ДАННЫХ
    const curr = dv.current();
    if (!curr || !curr.file) {
        dv.paragraph("⛔️ Ошибка: Не удалось получить информацию о текущем файле.");
        return;
    }

    // 2. ПОИСК ИСТОЧНИКОВ (ПОД-ПРОЕКТОВ И ЗАДАЧ)
    // Эффективно находим все страницы, которые ссылаются на текущий файл
    // и где эта ссылка находится именно в frontmatter.
    const sourcePages = dv.array(curr.file.inlinks.map(link => dv.page(link.path)))
        .where(p => {
            if (!p || !p.file || !p.file.frontmatter) return false;
            // Проверяем все значения в frontmatter на наличие ссылки на текущий файл
            for (const key of Object.keys(p.file.frontmatter)) {
                const value = p[key];
                const links = Array.isArray(value) ? value : [value];
                if (links.some(link => dv.value.isLink(link) && link.path === curr.file.path)) {
                    return true;
                }
            }
            return false;
        });

    // 3. АГРЕГАЦИЯ ДАННЫХ
    // Инициализируем счетчики для всех статусов нулями.
    const totalCounts = Object.fromEntries(Object.values(STATUSES).map(s => [s.key, 0]));

    for (const p of sourcePages) {
        const fm = p.file.frontmatter;
        if (!fm) continue;

        // Проверяем, является ли источник "под-проектом" (Тип А)
        // Признак: наличие хотя бы одного из специфичных ключей `tasks...`
        const isSubProject = Object.values(STATUSES).some(s => fm.hasOwnProperty(s.fmKey));

        if (isSubProject) {
            // Это под-проект. Суммируем его готовые счетчики.
            for (const statusInfo of Object.values(STATUSES)) {
                const count = parseInt(fm[statusInfo.fmKey], 10) || 0;
                totalCounts[statusInfo.key] += count;
            }
        } else if (typeof fm.tasks === 'string' && fm.tasks.includes('/')) {
            // Это "список задач" (Тип Б) с чек-листами.
            const parts = fm.tasks.split('/');
            if (parts.length !== 2) continue;

            const done = parseInt(parts[0], 10);
            const total = parseInt(parts[1], 10);

            if (isNaN(done) || isNaN(total)) continue;

            // 1. Всегда добавляем выполненные задачи в счетчик 'done'.
            totalCounts.done += done;

            const uncompleted = total - done;
            if (uncompleted > 0) {
                // 2. Определяем статус для НЕВЫПОЛНЕННЫХ задач из поля 'status' этого же файла.
                let statusKey = 'notstarted'; // Статус по умолчанию.
                const statusValue = (Array.isArray(fm.status) ? fm.status[0] : fm.status)?.toLowerCase();

                if (statusValue) {
                    const statusInfo = STATUSES[statusValue] || Object.values(STATUSES).find(s => s.key === statusValue);
                    if (statusInfo) statusKey = statusInfo.key;
                }
                // 3. Добавляем невыполненные задачи в счетчик найденного статуса.
                totalCounts[statusKey] += uncompleted;
            }
        }
    }

    // 4. РАСЧЕТ ИТОГОВ
    const totalDone = totalCounts.done;
    const totalAll = Object.values(totalCounts).reduce((sum, count) => sum + count, 0);
    const totalForProgress = totalAll - totalCounts.cancelled;
    // Рассчитываем знаменатель для статусов, которые еще не завершены.
    // Это общее количество задач минус отмененные и завершенные.
    const totalRemaining = totalForProgress - totalDone;

    // 5. ОБНОВЛЕНИЕ FRONTMATTER (ТОЛЬКО ПРИ НЕОБХОДИМОСТИ)
    const tfile = app.vault.getAbstractFileByPath(curr.file.path);
    if (tfile && !tfile.children) { // Убедимся, что это файл, а не папка
        const currentFm = curr.file.frontmatter || {};
        const newFmValues = {
            tasks: `${totalDone}/${totalForProgress || 0}`,
            comp: totalForProgress > 0 ? `${Math.round((totalDone / totalForProgress) * 100)}%` : "0%",
            ...Object.fromEntries(Object.values(STATUSES).map(s => [s.fmKey, totalCounts[s.key]]))
        };

        const needsUpdate = Object.keys(newFmValues).some(key => currentFm[key] !== newFmValues[key]);

        if (needsUpdate) {
            await app.fileManager.processFrontMatter(tfile, fm => {
                Object.assign(fm, newFmValues);
            });
        }
    }

    // 6. ФОРМИРОВАНИЕ И ВЫВОД РЕЗУЛЬТАТА
    if (totalAll === 0) {
        dv.paragraph("Нет связанных подзадач или проектов.");
    } else {
        // 6.1. Вывод общей сводки
        const completionPercentage = totalForProgress > 0 ? Math.round((totalDone / totalForProgress) * 100) : 0;
        dv.paragraph(`🎯 **Tasks**: ${totalDone}/${totalForProgress} &nbsp;&nbsp;&nbsp; 📈 **Completion**: ${completionPercentage}%`);

        // 6.2. Разделитель
        dv.paragraph('<hr />');

        // 6.3. Детальная статистика по статусам
        const tableRows = [];
        const cellStyle = "border: none; background: transparent;";
        for (const statusName of DISPLAY_ORDER) {
            const statusInfo = STATUSES[statusName];
            const count = totalCounts[statusInfo.key];

            if (count > 0) {
                const statusCell = `<td style="${cellStyle} padding-right: 1em;">${statusInfo.emoji}&nbsp;${statusInfo.name}:</td>`;
                let progressCell;
                if (statusInfo.key === 'cancelled') {
                    progressCell = `<td style="${cellStyle}"><b>${count}</b></td>`;
                } else {
                    // Для незавершенных статусов используем в качестве знаменателя только оставшиеся задачи.
                    // Для статуса "Done" используем общий знаменатель (без отмененных).
                    const isRemainingStatus = ['inprogress', 'notstarted', 'postpone'].includes(statusInfo.key);
                    const denominator = isRemainingStatus ? totalRemaining : totalForProgress;
                    const progressTag = denominator > 0
                        ? `<progress value="${count}" max="${denominator}"></progress>`
                        : '';
                    progressCell = `<td style="${cellStyle} vertical-align: middle;">${progressTag}&nbsp;<b>${count}/${denominator || 0}</b></td>`;
                }
                tableRows.push(`<tr>${statusCell}${progressCell}</tr>`);
            }
        }

        if (tableRows.length > 0) {
            const tableHtml = `<table style="border-spacing: 0; border-collapse: collapse; border: none;"><tbody>${tableRows.join('')}</tbody></table>`;
            dv.el('div', tableHtml);
        }

        // Финальный разделитель
        dv.paragraph('<hr />');
    }
}

return renderProjectCompletion;
