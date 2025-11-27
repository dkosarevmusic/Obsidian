/**
 * --------------------------------------------------------------------------
 * Time KanBan - Main Logic
 * --------------------------------------------------------------------------
 * Этот файл содержит основную логику для рендеринга канбан-доски.
 * Он должен загружаться после config.js и utils.js.
 *
 * @param {object} dv - Глобальный объект API Dataview.
 */
TKB.renderKanban = function(dv) {

    /**
     * Нормализует поле (которое может быть строкой, ссылкой, массивом) в строку для сравнения.
     * Сортирует элементы массива для консистентности.
     * @param {*} field - Поле для нормализации.
     * @param {boolean} isLink - Является ли поле ссылкой/массивом ссылок.
     * @returns {string}
     */
    function getComparableString(field, isLink = false) {
        if (!field) return "";
        const arr = Array.isArray(field) ? field : [field];
        const items = isLink 
            ? arr.map(l => (typeof l === 'string' ? l : l.path))
            : arr.map(String);
        return items.sort().join('|');
    }

    /**
     * Рендерит поле wikilinks в виде кликабельных ссылок, разделенных пробелом.
     * @param {*} wl - Поле wikilinks (одиночное значение или массив).
     * @returns {string}
     */
    function renderWikilinks(wl) {
        if (!wl) return "";
        const links = Array.isArray(wl) ? wl : [wl];
        return links
            .map(l => {
                if (!l) return "";
                const path = typeof l === "string" ? l : l.path;
                // Если есть display name (алиас), используем его
                const name = typeof l === "string" ? null : l.name;
                return dv.fileLink(path, name);
            })
            .join(" ");
    }

    /**
     * Сравнивает две задачи для комплексной сортировки (новая, улучшенная версия).
     * @param {object} a - Первая задача (страница)
     * @param {object} b - Вторая задача (страница)
     * @returns {number}
     */
    function compareTasks(a, b) {
        // Используем "цепочку" сравнений. Если результат не 0, возвращаем его.
        return (
            // 1. По дате (основной ключ).
            (TKB.toDate(a.date)?.getTime() || 0) - (TKB.toDate(b.date)?.getTime() || 0) ||
            
            // 2. По статусу "important" (важные задачи всегда выше в своей группе).
            (() => {
                const aStatus = Array.isArray(a.status) ? a.status : [String(a.status)];
                const bStatus = Array.isArray(b.status) ? b.status : [String(b.status)];
                return (bStatus.includes('important') || false) - (aStatus.includes('important') || false);
            })() ||

            // 3. По времени (задачи со временем всегда выше, затем сортировка по значению).
            (!!b.time - !!a.time) ||
            (() => {
                let timeA = a.time === null || typeof a.time === 'undefined' ? '' : a.time;
                let timeB = b.time === null || typeof b.time === 'undefined' ? '' : b.time;

                // Приводим числовое время (напр. 800) к строке с ведущим нулем ('0800') для корректного сравнения
                if (typeof timeA === 'number') {
                    timeA = String(timeA).padStart(4, '0');
                }
                if (typeof timeB === 'number') {
                    timeB = String(timeB).padStart(4, '0');
                }
                return String(timeA).localeCompare(String(timeB));
            })() ||

            // 4. По остальным полям для стабильной сортировки.
            getComparableString(a.status).localeCompare(getComparableString(b.status)) ||
            getComparableString(a.Area).localeCompare(getComparableString(b.Area)) ||
            getComparableString(a.wikilinks, true).localeCompare(getComparableString(b.wikilinks, true)) ||

            // 5. По имени файла как последний критерий.
            a.file.name.localeCompare(b.file.name)
        );
    }

    // 1. Получаем и ОДИН РАЗ сортируем все задачи
    const pagesArr = dv.pages(TKB.SOURCE_PATH)
      .where(p => {
          if (!p.date || !p.status) return false;
          const pageStatuses = Array.isArray(p.status) ? p.status : [String(p.status)];
          return pageStatuses.some(s => TKB.ALLOWED_STATUSES.includes(s));
      })
      .array()
      .sort(compareTasks);

    // 2. Группируем задачи по секциям за ОДИН проход
    const groupedTasks = Object.fromEntries(TKB.SECTION_ORDER.map(title => [title, []]));

    for (const p of pagesArr) {
        const d = TKB.toDate(p.date);
        if (d < TKB.today) { groupedTasks["Before Today"].push(p); }
        else if (d.getTime() === TKB.today.getTime()) { groupedTasks["Today"].push(p); }
        else if (d.getTime() === TKB.tomorrow.getTime()) { groupedTasks["Tomorrow"].push(p); }
        else if (d >= TKB.weekStart && d <= TKB.weekEnd) { groupedTasks["Week"].push(p); }
        else if (d >= TKB.startMonth && d <= TKB.endMonth) { groupedTasks["Month"].push(p); }
        else if (d >= TKB.startQuarter && d <= TKB.endQuarter) { groupedTasks["Quarter"].push(p); }
        else if (d >= TKB.startYear && d <= TKB.endYear) { groupedTasks["Year"].push(p); }
        else { groupedTasks["Future"].push(p); }
    }

    // 3. Отображаем непустые секции
    for (const title of TKB.SECTION_ORDER) {
      const list = groupedTasks[title];
      if (!list.length) continue;

      dv.header(2, `${TKB.SECTION_EMOJIS[title]} ${title}`);
      dv.paragraph(`Tasks: **${list.length}**`);
      dv.table(TKB.TABLE_COLUMNS, list.map(p => [
        TKB.colorStatus(p.status),
        TKB.colorArea(p.Area),
        dv.el("a", p.file.name, { href: "obsidian://advanced-uri?filepath=" + encodeURIComponent(p.file.path) }),
        p.icon || "",
        renderWikilinks(p.wikilinks),
        TKB.colorWeekday(TKB.getWeekday(p.date)),
        TKB.colorPercent(p.comp),
        TKB.colorTasks(p.tasks),
        p.date,
        p.time,
        p["due-date"],
        TKB.coloredList(p.tags)
      ]));

      dv.el("hr", {}, dv.containerEl);
    }
};