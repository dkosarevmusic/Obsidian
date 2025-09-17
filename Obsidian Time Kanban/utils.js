/**
 * Time KanBan - Utility Functions
 *
 * Содержит вспомогательные функции для рендеринга:
 * - Создание цветных "бейджей"
 * - Функции для раскраски полей (Area, Status, Weekday, Tags)
 * - Функции для отображения прогресса (comp, tasks)
 * - Вспомогательные утилиты для дат и хеширования
 *
 * Зависит от: config.js (для цветовых карт)
 */

/**
 * ─── Badge generator & color functions ────────────────────────────────────
 */
/** @param {string} text @param {string} hslColor @returns {string} HTML span badge */
TKB.makeBadge = function(text, hslColor) {
    const bg = hslColor.replace('hsl(', 'hsla(').replace(')', ',0.2)');
    const style = `background-color:${bg};border-radius:0.3em;padding:0.1em 0.4em;color:${hslColor};font-weight:500;white-space:nowrap;`;
    return `<span style="${style}">${text}</span>`;
}
TKB.colorBadge = function(items, colorMap) {
  if (!items) return "";
  const arr = Array.isArray(items) ? items : [items];
  return arr.map(v => TKB.makeBadge(v, colorMap[v] || "hsl(0,0%,80%)")).join(" ");
}
TKB.colorArea    = a  => TKB.colorBadge(a, TKB.areaColors);
TKB.colorStatus  = s  => TKB.colorBadge(s, TKB.statusColors);
TKB.colorWeekday = wd => TKB.colorBadge(wd, TKB.weekdayColors);

/** Auto-generated HSL for arbitrary tag strings. */
TKB.coloredList = function(list) {
  if (!list) return "";
  return (Array.isArray(list) ? list : [list])
    .map(x => TKB.makeBadge(x, `hsl(${Math.abs(TKB.stringToHash(x)) % 360},60%,50%)`))
    .join(" ");
}
TKB.stringToHash = function(str) {
  let h = 0; for (let c of String(str)) { h = (h << 5) - h + c.charCodeAt(0); h |= 0; }
  return h;
}
TKB.toDate = function(d) { return d?.toJSDate ? d.toJSDate() : new Date(d); }
TKB.getWeekday = function(d) {
  const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  return days[TKB.toDate(d).getDay()];
}

/**
 * ─── Новый бадж-компонент для процента выполнения ──────────────────────────
 */
TKB.percentToHsl = function(percent) {
  const clamped = Math.max(0, Math.min(100, percent));
  const hue = (clamped * 120) / 100; // 0 (красный) → 120 (зелёный)
  return `hsl(${hue}, 100%, 45%)`;
}
TKB.colorPercent = function(comp) {
  if (comp == null) return "";
  let value;
  if (typeof comp === "string") {
    const parsed = parseFloat(comp.replace("%", "").trim());
    if (isNaN(parsed)) return "";
    value = parsed;
  } else if (typeof comp === "number") {
    value = comp;
  } else {
    return "";
  }
  const percent = Math.round(value);
  const hsl = TKB.percentToHsl(percent);
  return TKB.makeBadge(`${percent}%`, hsl);
}

/**
 * ─── Новый бадж-компонент для поля tasks (дробное отношение) ─────────────
 */
TKB.colorTasks = function(tasks) {
  if (!tasks) return "";
  // Используем хэш строки для получения консистентного (не случайного) цвета
  const color = `hsl(${Math.abs(TKB.stringToHash(String(tasks))) % 360}, 60%, 50%)`;
  return TKB.makeBadge(tasks, color);
}