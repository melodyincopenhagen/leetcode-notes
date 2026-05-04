// 统一把 UTC 时间字符串（来自 SQLite datetime('now')，形如 "2026-05-02 03:15:00"）
// 按太平洋时间显示。自动处理 PST/PDT 切换。

const PT = 'America/Los_Angeles';

// 把后端的 "YYYY-MM-DD HH:MM:SS"（UTC）解析成 Date 对象
function parseUtc(s) {
  if (!s) return null;
  // 替换空格为 T，并补 Z 表明是 UTC
  return new Date(s.replace(' ', 'T') + 'Z');
}

// 显示成 "YYYY-MM-DD"（PT）
export function formatDatePT(s) {
  const d = parseUtc(s);
  if (!d || isNaN(d)) return '';
  // en-CA 输出 ISO 风格 YYYY-MM-DD
  return d.toLocaleDateString('en-CA', { timeZone: PT });
}

// 当前 PT 时区的"今天"开始时刻（本地 Date 对象，用于和其它本地 Date 做比较）
export function todayStartPT() {
  const iso = new Date().toLocaleDateString('en-CA', { timeZone: PT });
  return new Date(iso + 'T00:00:00');
}

// 给 Date 对象返回它在 PT 时区下的 ISO 日期 YYYY-MM-DD
export function ptIsoDate(d) {
  return d.toLocaleDateString('en-CA', { timeZone: PT });
}
