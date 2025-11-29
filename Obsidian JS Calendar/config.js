/**
 * Конфигурация для JS Calendar.
 */
OJSC.config = {
    // Источник задач (например, папка, тег или ссылка)
    source: '"Life Manager/MDs"',

    // Поле в заметках, которое содержит дату для календаря
    dateField: 'date',

    // Поле для отображения в качестве заголовка события
    summaryField: 'text',

    // Поле, содержащее статус задачи (как в Kanban)
    statusField: 'status',

    // Статусы, которые нужно отображать в календаре. Задачи с другими статусами будут скрыты.
    allowedStatuses: ["important", "imschedule", "imw", "in progress"],

    // Начальный вид календаря ('month', 'week', 'day')
    initialView: 'month'
};