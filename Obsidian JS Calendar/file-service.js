/**
 * @file file-service.js
 * Сервис для взаимодействия с файловой системой Obsidian.
 */
if (!window.OJSC) window.OJSC = {};
if (!OJSC.services) OJSC.services = {};

OJSC.services.file = {
    /**
     * Обновляет поле даты в frontmatter указанного файла.
     * @param {object} dv - Глобальный объект API Dataview.
     * @param {string} filePath - Путь к файлу.
     * @param {string} newDate - Новая дата в формате 'YYYY-MM-DD'.
     */
    updateTaskDate: (dv, filePath, newDate) => {
        const tfile = dv.app.vault.getAbstractFileByPath(filePath);
        if (!tfile) {
            console.error(`[OJSC] Файл не найден: ${filePath}`);
            return;
        }
        dv.app.fileManager.processFrontMatter(tfile, (fm) => {
            fm[OJSC.config.dateField] = newDate;
        });
    }
};