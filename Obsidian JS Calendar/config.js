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
    initialView: 'month',

    // Цветовая карта для поля 'Area' (скопировано из Time KanBan)
    areaColors: {
        Work:"hsl(30,100%,50%)", Skills:"hsl(220,100%,50%)",
        Optimization:"hsl(0,0%,100%)", Matter:"hsl(120,100%,50%)",
        Health:"hsl(150,72%,42%)", Housekeep:"hsl(75,100%,50%)",
        Art:"hsl(280,100%,50%)", Spirit:"hsl(330,100%,88%)",
        Social:"hsl(200,100%,70%)", Fun:"hsl(60,100%,50%)"
    }
};