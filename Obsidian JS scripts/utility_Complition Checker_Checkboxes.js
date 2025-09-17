async function renderCheckboxCompletion(dv, app) {
  // --- НАСТРОЙКИ ---
  // Ключи, когда прогресс ВИДИМ для других скриптов
  const VISIBLE_COMP_KEY = 'comp';
  const VISIBLE_TASKS_KEY = 'tasks';
  // Ключи, когда прогресс СКРЫТ
  const HIDDEN_COMP_KEY = 'compx';
  const HIDDEN_TASKS_KEY = 'tasksx';
  // Ключ-переключатель видимости
  const VISIBILITY_KEY = 'compvis';

  // --- 1. ПОЛУЧЕНИЕ ДАННЫХ ---
  const file = dv.current().file;
  const fm = file.frontmatter;
  const allTasks = file.tasks || [];
  
  // --- 2. ОПРЕДЕЛЕНИЕ СОСТОЯНИЯ ---
  // По умолчанию, видимость включена (true). Она выключена, только если явно указано `false`.
  const isVisible = fm[VISIBILITY_KEY] !== false; 
  
  const compKey = isVisible ? VISIBLE_COMP_KEY : HIDDEN_COMP_KEY;
  const tasksKey = isVisible ? VISIBLE_TASKS_KEY : HIDDEN_TASKS_KEY;
  const oldCompKey = isVisible ? HIDDEN_COMP_KEY : VISIBLE_COMP_KEY;
  const oldTasksKey = isVisible ? HIDDEN_TASKS_KEY : VISIBLE_TASKS_KEY;

  // --- 3. ВЫЧИСЛЕНИЕ ЗНАЧЕНИЙ ---
  const total = allTasks.length;
  const done = allTasks.where(t => t.completed).length;
  const newPct = total > 0 ? Math.round(done / total * 100) : 0;
  const newPctStr = `${newPct}%`;
  const newRatio = `${done}/${total}`;

  // --- 4. ЛОГИКА ОБНОВЛЕНИЯ FRONTMATTER ---
  const updates = {};
  const deletions = [];

  // 4.1. Устанавливаем `compvis` по умолчанию, если его нет
  if (fm[VISIBILITY_KEY] === undefined) {
    updates[VISIBILITY_KEY] = true;
  }

  // 4.2. Обрабатываем поле `comp` / `compx`
  // Если старый ключ (например, `compx`) существует, его нужно удалить
  if (fm.hasOwnProperty(oldCompKey)) {
    deletions.push(oldCompKey);
  }
  // Если целевой ключ (`comp`) отсутствует, имеет другое значение, или произошло переименование - обновляем
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

  // 4.4. Применяем все изменения одним махом, если они есть
  if (Object.keys(updates).length > 0 || deletions.length > 0) {
    const tfile = app.vault.getAbstractFileByPath(file.path);
    if (tfile && !tfile.children) { // Убедимся, что это файл, а не папка
      await app.fileManager.processFrontMatter(tfile, (frontmatter) => {
        // Применяем обновления
        for (const key in updates) {
          frontmatter[key] = updates[key];
        }
        // Удаляем старые ключи
        for (const key of deletions) {
          delete frontmatter[key];
        }
      });
    }
  }

  // --- 5. ВЫВОД В PREVIEW ---
  if (total === 0) {
    dv.paragraph("В этой заметке нет задач.");
  } else {
    // 5.1. Вывод общей сводки в одну строку
    dv.paragraph(`🎯 **Tasks**: ${newRatio} &nbsp;&nbsp;&nbsp; ✅ **Completion**: **${newPctStr}**`);
  }
}

return renderCheckboxCompletion;