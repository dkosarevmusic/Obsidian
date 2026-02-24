# Техническое Задание: Миграция Календаря на Bases API

## 1. Цель

Полностью перевести систему получения данных для "Obsidian JS Calendar" с API плагина Dataview на API плагина Bases. Цель - значительно повысить производительность и упростить логику запросов к данным.

## 2. Мотивация

Текущая реализация, использующая `dataviewjs`, на лету читает и анализирует (парсит) все файлы из указанной папки при каждом запросе. Это приводит к снижению производительности по мере роста количества заметок.

Плагин `Bases` работает иначе: он заранее создает и поддерживает в актуальном состоянии постоянный, структурированный **индекс** свойств файлов. Запросы к этому индексу выполняются почти мгновенно, так как не требуют повторного чтения и анализа файлов. Переход на `Bases` сделает календарь значительно быстрее и отзывчивее.

## 3. Ключевые Принципы

- **Пользовательский интерфейс (UI) не меняется.** Весь код, отвечающий за рендеринг (создание HTML, применение CSS), остается прежним.
- **Рабочий процесс не меняется.** Задачи по-прежнему являются `.md` файлами с YAML-свойствами. Редактирование файлов будет так же отражаться в календаре благодаря двусторонней синхронизации `Bases`.
- **Миграция затрагивает только логику доступа к данным.**
- **Старая версия сохраняется.** Оригинальная папка `Obsidian JS Calendar` и запускающий файл `Calendar.md` остаются нетронутыми. Это позволяет использовать старую версию в качестве эталона или запасного варианта.

## 4. План Миграции

### Шаг 0: Подготовка и Изоляция Кода

1.  **Скопировать все файлы** из папки `Obsidian JS Calendar` в новую папку `Obsidian JS Calendar (Bases)`.
2.  Это создаст полностью изолированную среду для разработки новой версии, не затрагивая работающий календарь. Все дальнейшие изменения будут производиться только в папке `Obsidian JS Calendar (Bases)`.

### Шаг 1: Настройка "Базы" (Base)

1.  В Obsidian UI создать новую "базу" (Base).
2.  Настроить ее так, чтобы она отслеживала папку с задачами (например, `"Life Manager/MDs"`).
3.  Убедиться, что все используемые в календаре YAML-свойства (`date`, `status`, `summaryField`, `time`, `Area` и т.д.) распознались и отображаются как колонки в таблице `Bases`. Это подтвердит, что индекс создан корректно.

### Шаг 2: Модификация Сервиса Данных (`data-service.js`)

Это основной этап. Необходимо переписать файл `data-service.js` **внутри папки `Obsidian JS Calendar (Bases)`**, сохранив его "публичный контракт": функции должны по-прежнему возвращать массивы объектов-задач в том же формате, что и раньше.

**Пример "до" (Dataview):**
```javascript
// OJSC.services.data.js

getAllTasksFromDataview: (dv) => {
    // ...
    const tasks = dv.pages(OJSC.config.source).where(p => p[dateField]).values;
    // ...
},

getTasks: (dv, statusMode) => {
    const allTasks = this.getAllTasksFromDataview(dv);
    // ... фильтрация на клиенте ...
    return allTasks.filter(/* ... */);
}
```

**Пример "после" (Bases API):**
```javascript
// OJSC.services.data.js

// Глобальный доступ к базе, инициализируется один раз
const db = app.plugins.plugins.bases.getDatabase("Имя вашей базы");

getAllTasks: () => {
    // Просто возвращаем все задачи из проиндексированной базы
    return db.items.all();
},

getTasks: (statusMode) => {
    const allowedStatuses = OJSC.config.statusModes[statusMode]?.statuses || [];
    if (!allowedStatuses.length) return [];

    // Фильтрация и сортировка выполняются движком Bases - это очень быстро
    const tasks = db.items
                  .where(item => item[OJSC.config.dateField]) // Убеждаемся, что дата есть
                  .where(item => {
                      const pageStatuses = Array.isArray(item[OJSC.config.statusField]) ? item[OJSC.config.statusField] : [item[OJSC.config.statusField]];
                      return pageStatuses.some(s => allowedStatuses.includes(s));
                  })
                  // Сложную сортировку из task-utils.js нужно перенести сюда, используя .orderBy()
                  .orderBy(item => item.time, 'desc') 
                  .all();
    
    // Важно: нужно убедиться, что объекты, возвращаемые .all(),
    // имеют ту же структуру, что и объекты от Dataview, 
    // чтобы UI-компоненты работали без изменений.
    return tasks;
}
```

**Важно:** Логику сложной сортировки из `task-utils.js` следует максимально перенести в запрос к `Bases` с помощью цепочки вызовов `.orderBy()`. Это значительно повысит производительность.

### Шаг 3: Создание Файла-Запускателя для "Bases View"

Вместо изменения старого `Calendar.md`, мы создадим новый, чистый способ запуска.

1.  **Создать новый MD-файл** в вашем хранилище, например, `Calendar (Bases).md`.
2.  Поместить в него следующий код. Этот блок `bases-view` указывает Obsidian, где найти код для рендеринга.
    ````markdown
    ```bases-view
    path: "Obsidian JS Calendar (Bases)/view"
    ```
    ````
3.  **Создать файлы `view.js` и `view.json`** в папке `Obsidian JS Calendar (Bases)`. Имя `view` в пути выше (`path`) соответствует имени этих файлов.
    *   `view.json` (конфигурация представления, может быть пустым: `{}`)
    *   `view.js` (новый входной файл для рендеринга)

4.  **Наполнить `view.js`** кодом-загрузчиком, который теперь будет ссылаться на скрипты в своей собственной папке.

**Содержимое для `view.js`:**
```javascript
/**
 * Obsidian JS Calendar (Bases View) - Загрузчик
 */

if (!window.OJSC) window.OJSC = {};

try {
    // Путь к скриптам теперь указывает на текущую, новую папку
    const SCRIPT_FOLDER = "Obsidian JS Calendar (Bases)"; 
    
    const SCRIPT_FILES = [
        "config.js",
        "date-utils.js", "task-utils.js",
        "data-service.js", // <-- Новая, измененная версия из этой же папки
        "file-service.js",
        "state.js",
        "day-card-component.js", "month-grid-component.js", "header-component.js",
        "main.js"
    ];

    // Загрузка всех скриптов
    for (const fileName of SCRIPT_FILES) {
        const scriptPath = `${SCRIPT_FOLDER}/${fileName}`;
        const scriptContent = await dv.io.load(scriptPath);
        if (!scriptContent) {
            throw new Error(`Файл скрипта пуст или не найден: ${scriptPath}`);
        }
        new Function('OJSC', 'dv', 'luxon', scriptContent)(OJSC, dv, dv.luxon);
    }

    // --- ЗАПУСК КАЛЕНДАРЯ ---
    OJSC.renderCalendar(dv);

} catch (e) {
    dv.el('div', `**Ошибка загрузки скриптов календаря.**
- Текст ошибки: `${e.message}``, {attr: {style: "color: red;"}});
    console.error("OJSC Calendar Load Error:", e);
}
```

### Шаг 4: Финальная проверка
1.  Оставить старый файл `Calendar.md` и папку `Obsidian JS Calendar` без изменений.
2.  Открыть новый файл `Calendar (Bases).md`.
3.  Убедиться, что календарь (версии Bases) отображается корректно.
4.  Проверить, что производительность заметно улучшилась при навигации по месяцам.
5.  Внести изменение в одну из задач (например, поменять дату через YAML) и убедиться, что календарь обновился.

## 5. Справочные материалы

- **Официальная документация Bases:**
  - [Обзор (Help)](https://help.obsidian.md/bases)
  - [Руководство по Bases View](https://docs.obsidian.md/plugins/guides/bases-view)
- **API Obsidian (для общего развития):**
  - [Obsidian API Docs](https://github.com/obsidianmd/obsidian-api)
