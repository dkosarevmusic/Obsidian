/**
 * @file month-grid-component.js
 * Компонент для создания сетки одного месяца.
 */
if (!window.OJSC) window.OJSC = {};
if (!OJSC.ui) OJSC.ui = {};

OJSC.ui.createMonthGrid = (monthDate, tasksByDate, viewType, dv, onTaskDrop, statusMode, showTime) => {
    const monthContainer = document.createElement('div');
    monthContainer.className = 'ojsc-month-container';

    const weekdaysHeader = document.createElement('div');
    weekdaysHeader.className = 'ojsc-weekdays-header';
    ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].forEach((day, index) => {
        const weekday = document.createElement('div');
        weekday.textContent = day;
        weekday.className = 'ojsc-weekday';
        if (index >= 5) {
            weekday.classList.add('ojsc-weekend');
        }
        weekdaysHeader.appendChild(weekday);
    });
    monthContainer.appendChild(weekdaysHeader);

    const grid = document.createElement('div');
    grid.className = 'ojsc-month-grid';

    let currentDay = monthDate.startOf('month').startOf('week');
    const endDay = monthDate.endOf('month').endOf('week');

    while (currentDay <= endDay) {
        const card = OJSC.ui.createDayCard(currentDay, tasksByDate, viewType, dv, onTaskDrop, statusMode, showTime);
        card.classList.add('ojsc-month-grid-card');
        if (currentDay.month !== monthDate.month) {
            card.classList.add('ojsc-other-month');
        }
        grid.appendChild(card);
        currentDay = currentDay.plus({ days: 1 });
    }
    monthContainer.appendChild(grid);
    return monthContainer;
};