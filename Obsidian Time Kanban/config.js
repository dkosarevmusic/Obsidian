/**
 * Time KanBan - Configuration File
 *
 * Содержит статичные конфигурационные данные:
 * - Границы временных периодов
 * - Цветовые карты для областей, статусов и дней недели
 */

/**
 * ─── Period boundaries ────────────────────────────────────────────────────
 */
TKB.today       = new Date(); TKB.today.setHours(0,0,0,0);
TKB.tomorrow    = new Date(TKB.today); TKB.tomorrow.setDate(TKB.today.getDate() + 1);
TKB.wd          = (TKB.today.getDay() + 6) % 7;
TKB.weekStart   = new Date(TKB.today); TKB.weekStart.setDate(TKB.today.getDate() - TKB.wd);
TKB.weekEnd     = new Date(TKB.weekStart); TKB.weekEnd.setDate(TKB.weekStart.getDate() + 6);
TKB.startMonth  = new Date(TKB.today.getFullYear(), TKB.today.getMonth(), 1);
TKB.endMonth    = new Date(TKB.today.getFullYear(), TKB.today.getMonth() + 1, 0);
TKB.qm          = Math.floor(TKB.today.getMonth() / 3) * 3;
TKB.startQuarter= new Date(TKB.today.getFullYear(), TKB.qm, 1);
TKB.endQuarter  = new Date(TKB.today.getFullYear(), TKB.qm + 3, 0);
TKB.startYear   = new Date(TKB.today.getFullYear(), 0, 1);
TKB.endYear     = new Date(TKB.today.getFullYear(), 11, 31);

/**
 * ─── Color maps ─────────────────────────────────────────────────────────────
 */
TKB.areaColors = {
  Work:"hsl(30,100%,50%)", Skills:"hsl(220,100%,50%)",
  Optimization:"hsl(0,0%,100%)", Matter:"hsl(120,100%,50%)",
  Health:"hsl(150,72%,42%)", Housekeep:"hsl(75,100%,50%)",
  Art:"hsl(280,100%,50%)", Spirit:"hsl(330,100%,88%)",
  Social:"hsl(200,100%,70%)", Fun:"hsl(60,100%,50%)"
};
TKB.statusColors = {
  "not started":"hsl(0,0%,50%)", "in progress":"hsl(60,100%,50%)",
  done:"hsl(120,100%,40%)", postpone:"hsl(220,100%,50%)",
  cancelled:"hsl(0,100%,50%)", important:"hsl(0,100%,50%)",
  imschedule:"hsl(10,70%,30%)", imw:"hsl(30,100%,50%)"
};
TKB.weekdayColors = {
  Mon:"hsl(220,80%,65%)", Tue:"hsl(180,90%,55%)",
  Wed:"hsl(140,80%,50%)", Thu:"hsl(80,90%,55%)",
  Fri:"hsl(45,100%,55%)",  Sat:"hsl(0,90%,60%)",
  Sun:"hsl(20,100%,55%)"
};

/**
 * ─── Main script configuration ────────────────────────────────────────────
 */
TKB.SOURCE_PATH = '"Life Manager/MDs"';
TKB.ALLOWED_STATUSES = ["important", "imschedule", "imw", "in progress"];
TKB.SECTION_ORDER = ["Before Today", "Today", "Tomorrow", "Week", "Month", "Quarter", "Year", "Future"];
TKB.SECTION_EMOJIS = {
  "Before Today":"⏪", "Today":"☀️", "Tomorrow":"🌅",
  "Week":"📅", "Month":"🗓️", "Quarter":"📊", "Year":"📆", "Future":"🚀"
};
TKB.TABLE_COLUMNS = ["ST", "AR", "FL", "IC", "WL", "WD", "CP", "TS", "DT", "TM", "DD", "TG"];