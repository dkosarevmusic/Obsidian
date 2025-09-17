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
    const statusSources = {
        inprogress: new Set(),
        notstarted: new Set(),
        postpone: new Set(),
        cancelled: new Set()
    };

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
                if (count > 0 && statusSources.hasOwnProperty(statusInfo.key)) {
                    statusSources[statusInfo.key].add(p.file.path);
                }
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
                if (statusSources.hasOwnProperty(statusKey)) {
                    statusSources[statusInfo.key].add(p.file.path);
                }
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
        // Используем flexbox вместо таблицы для надежной работы выпадающих списков.
        const flexRows = [];
        for (const statusName of DISPLAY_ORDER) {
            const statusInfo = STATUSES[statusName];
            const count = totalCounts[statusInfo.key];

            if (count > 0) {
                const statusCell = `<div style="width: 120px; flex-shrink: 0;">${statusInfo.emoji}&nbsp;${statusInfo.name}:</div>`;
                let progressContent = '';

                const sourceSet = statusSources[statusInfo.key];
                let fileNamesString = '';
                if (sourceSet && sourceSet.size > 0) {
                    const fileListItems = Array.from(sourceSet)
                        .sort() // Сортируем для единообразия
                        .map(path => { // ... (код для создания ссылок остается без изменений)
                            const linkTarget = path.replace(/\.md$/, '');
                            const linkText = linkTarget.includes('/') ? linkTarget.substring(linkTarget.lastIndexOf('/') + 1) : linkTarget;
                            return `<li><a data-href="${linkTarget}" href="${linkTarget}" class="internal-link">${linkText}</a></li>`;
                        })
                        .join('');
                    
                    // <details> с абсолютно позиционированным списком.
                    // Это работает надежнее в flexbox-контейнере, чем в таблице.
                    fileNamesString = `
                        <div style="position: relative; display: inline-block; vertical-align: middle; margin-left: 8px; top: -0.07em;">
                            <details>
                                <summary style="cursor: pointer; font-size: 0.8em; color: var(--text-normal); list-style: none; display: inline-block; background-color: var(--background-secondary); border: 1px solid var(--background-modifier-border); border-radius: 5px; padding: 2px 8px; line-height: 1.2;">
                                    <b>in ${sourceSet.size} files</b>
                                </summary>
                                <ul style="position: absolute; top: 100%; left: 0; z-index: 10; width: max-content; max-width: 400px; background-color: var(--background-secondary); border: 1px solid var(--background-modifier-border); border-radius: 6px; padding: 8px 8px 8px 0px; margin-top: 5px; list-style-type: disc; text-align: left;">
                                    ${fileListItems}
                                </ul>
                            </details>
                        </div>`.replace(/\n\s*/g, '');
                }

                if (statusInfo.key === 'cancelled') {
                    progressContent = `<b>${count}</b>${fileNamesString}`;
                } else {
                    const isRemainingStatus = ['inprogress', 'notstarted', 'postpone'].includes(statusInfo.key);
                    const denominator = isRemainingStatus ? totalRemaining : totalForProgress;
                    const progressTag = denominator > 0 ? `<progress style="position: relative; top: 0.1em;" value="${count}" max="${denominator}"></progress>` : '';
                    progressContent = `${progressTag}&nbsp;<b>${count}/${denominator || 0}</b>${fileNamesString}`;
                }
                const progressCell = `<div style="display: flex; align-items: center;">${progressContent}</div>`;
                flexRows.push(`<div style="display: flex; align-items: center;">${statusCell}${progressCell}</div>`);
            }
        }

        if (flexRows.length > 0) {
            const flexContainerHtml = `<div style="display: flex; flex-direction: column; gap: 4px;">${flexRows.join('')}</div>`;
            dv.el('div', flexContainerHtml);

            // --- ЛОГИКА ЗАКРЫТИЯ ВЫПАДАЮЩИХ СПИСКОВ ПРИ КЛИКЕ ВНЕ ИХ ---
            const allDetails = dv.container.querySelectorAll('details');

            allDetails.forEach(details => {
                // Эта функция будет обрабатывать клики вне элемента
                const clickOutsideHandler = (event) => {
                    if (details.open && !details.contains(event.target)) {
                        details.removeAttribute('open'); // Закрываем, что вызовет 'toggle'
                    }
                };

                details.addEventListener('toggle', () => {
                    if (details.open) {
                        // Когда список открыт, добавляем глобальный слушатель.
                        // setTimeout нужен, чтобы этот обработчик не сработал на тот же клик,
                        // который и открыл список.
                        setTimeout(() => document.addEventListener('click', clickOutsideHandler), 0);
                    } else {
                        // Когда список закрыт, удаляем глобальный слушатель.
                        document.removeEventListener('click', clickOutsideHandler);
                    }
                });
            });
        }

        // Финальный разделитель
        dv.paragraph('<hr />');
    }
}

return renderProjectCompletion;
