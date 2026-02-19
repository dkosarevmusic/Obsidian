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
    },

    /**
     * Переключает статус задачи между 'in progress' и 'done'.
     * @param {object} dv - Глобальный объект API Dataview.
     * @param {string} filePath - Путь к файлу.
     */
    updateTaskStatus: (dv, filePath) => {
        return new Promise((resolve, reject) => {
            const tfile = dv.app.vault.getAbstractFileByPath(filePath);
            if (!tfile) {
                console.error(`[OJSC] Файл не найден: ${filePath}`);
                return reject(new Error(`Файл не найден: ${filePath}`));
            }
            dv.app.fileManager.processFrontMatter(tfile, (fm) => {
                const currentStatus = fm[OJSC.config.statusField];
                // Если статус 'done', переключаем на 'in progress'.
                // В противном случае — на 'done'.
                fm[OJSC.config.statusField] = currentStatus === 'done' ? 'in progress' : 'done';
            }).then(resolve).catch(reject);
        });
    },

    /**
     * Переключает статус задачи между 'in progress' и 'cancelled'.
     * @param {object} dv - Глобальный объект API Dataview.
     * @param {string} filePath - Путь к файлу.
     */
    updateTaskStatusInProgressCancel: (dv, filePath) => {
        return new Promise((resolve, reject) => {
            const tfile = dv.app.vault.getAbstractFileByPath(filePath);
            if (!tfile) {
                console.error(`[OJSC] Файл не найден: ${filePath}`);
                return reject(new Error(`Файл не найден: ${filePath}`));
            }
            dv.app.fileManager.processFrontMatter(tfile, (fm) => {
                const currentStatus = fm[OJSC.config.statusField];
                // Если статус 'cancelled', переключаем на 'in progress'.
                // В противном случае — на 'cancelled'.
                fm[OJSC.config.statusField] = currentStatus === 'cancelled' ? 'in progress' : 'cancelled';
            }).then(resolve).catch(reject);
        });
    },

    /**
     * Переключает статус задачи между 'in progress' и 'postpone'.
     * @param {object} dv - Глобальный объект API Dataview.
     * @param {string} filePath - Путь к файлу.
     */
    updateTaskStatusInProgressPostpone: (dv, filePath) => {
        return new Promise((resolve, reject) => {
            const tfile = dv.app.vault.getAbstractFileByPath(filePath);
            if (!tfile) {
                console.error(`[OJSC] Файл не найден: ${filePath}`);
                return reject(new Error(`Файл не найден: ${filePath}`));
            }
            dv.app.fileManager.processFrontMatter(tfile, (fm) => {
                const currentStatus = fm[OJSC.config.statusField];
                // Если статус 'postpone', переключаем на 'in progress'.
                // В противном случае — на 'postpone'.
                fm[OJSC.config.statusField] = currentStatus === 'postpone' ? 'in progress' : 'postpone';
            }).then(resolve).catch(reject);
        });
    }
};