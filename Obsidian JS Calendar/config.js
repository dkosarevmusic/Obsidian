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

    // Режимы отображения задач и соответствующие им статусы.
    statusModes: {
        "work": {
            name: "В работе",
            statuses: ["important", "imschedule", "imw", "in progress"]
        },
        "done": {
            name: "Готовые",
            statuses: ["done"]
        },
        "cancelled": {
            name: "Отмененные",
            statuses: ["cancelled"]
        },
        "postpone": {
            name: "Отложенные",
            statuses: ["postpone"]
        }
    },

    // Порог светлоты (в HSL) для определения "тёмных" цветов.
    // Цвета ниже этого порога будут обработаны для лучшей контрастности.
    darkColorLightnessThreshold: 65,

    // Цветовая карта для поля 'Area' (скопировано из Time KanBan)
    areaColors: {
        Work:"hsl(30,100%,50%)", Skills:"hsl(220,100%,50%)", // Возвращаем оригинальный синий
        Optimization:"hsl(0,0%,100%)", Matter:"hsl(120,100%,50%)",
        Health:"hsl(150,72%,42%)", Housekeep:"hsl(75,100%,50%)",
        Art:"hsl(280,100%,50%)", Spirit:"hsl(330,100%,88%)",
        Social:"hsl(200,100%,70%)", Fun:"hsl(60,100%,50%)"
    }
};