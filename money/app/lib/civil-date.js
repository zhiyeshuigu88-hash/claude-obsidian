/**
 * 暦日（CivilDate）のプリミティブ操作。
 * フェーズ0の civil-date.ts を Node.js(ESM) に移植したもの。ロジックは同一。
 *
 * 日付を Date ではなく 'YYYY-MM-DD' 形式の文字列として扱う。
 * ISO形式（ゼロ埋め）のため、文字列の辞書順比較 = 時系列順比較になる。
 */

const CIVIL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export const TIME_ZONE = 'Asia/Tokyo';

const pad2 = (n) => String(n).padStart(2, '0');

/** 形式として妥当で、かつ実在する日付かどうか */
export function isCivilDate(value) {
  if (typeof value !== 'string') return false;
  const matched = CIVIL_DATE_PATTERN.exec(value);
  if (!matched) return false;

  const year = Number(matched[1]);
  const month = Number(matched[2]);
  const day = Number(matched[3]);

  if (month < 1 || month > 12) return false;
  if (day < 1 || day > daysInMonth(year, month)) return false;
  return true;
}

export function assertCivilDate(value) {
  if (!isCivilDate(value)) {
    throw new TypeError(
      `不正な暦日です: ${JSON.stringify(value)} ('YYYY-MM-DD' 形式の実在する日付が必要)`,
    );
  }
}

/** 年月日から暦日を組み立てる。実在しない日付は例外。 */
export function toCivilDate(year, month, day) {
  const candidate = `${String(year).padStart(4, '0')}-${pad2(month)}-${pad2(day)}`;
  assertCivilDate(candidate);
  return candidate;
}

export function parts(date) {
  assertCivilDate(date);
  const matched = CIVIL_DATE_PATTERN.exec(date);
  return {
    year: Number(matched[1]),
    month: Number(matched[2]),
    day: Number(matched[3]),
  };
}

/** 指定年月の日数。month は 1〜12。 */
export function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * 指定日を、その月に存在する範囲へ丸めた暦日を返す。
 * 例: clampDay(2026, 2, 31) → '2026-02-28'
 */
export function clampDay(year, month, day) {
  if (!Number.isInteger(day) || day < 1) {
    throw new RangeError(`日は1以上の整数である必要があります: ${day}`);
  }
  const last = daysInMonth(year, month);
  return toCivilDate(year, month, Math.min(day, last));
}

const toUtcMs = (date) => {
  const { year, month, day } = parts(date);
  return Date.UTC(year, month - 1, day);
};

const fromUtcMs = (ms) => {
  const d = new Date(ms);
  return toCivilDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
};

const MS_PER_DAY = 86_400_000;

export function addDays(date, amount) {
  if (!Number.isInteger(amount)) {
    throw new RangeError(`加算日数は整数である必要があります: ${amount}`);
  }
  return fromUtcMs(toUtcMs(date) + amount * MS_PER_DAY);
}

/** a - b を日数で返す。a が後なら正。 */
export function diffDays(a, b) {
  return Math.round((toUtcMs(a) - toUtcMs(b)) / MS_PER_DAY);
}

/** a < b なら負、同じなら0、a > b なら正 */
export function compare(a, b) {
  assertCivilDate(a);
  assertCivilDate(b);
  return a < b ? -1 : a > b ? 1 : 0;
}

/** 前月の年月 */
export function previousMonth(year, month) {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

/** 翌月の年月 */
export function nextMonth(year, month) {
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
}

/**
 * 日本時間における「今日」の暦日。
 * タイムゾーンを意識するのはこの関数だけ。
 */
export function todayInTokyo(now = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const found = {};
  for (const part of formatter.formatToParts(now)) {
    if (part.type !== 'literal') found[part.type] = part.value;
  }

  return toCivilDate(Number(found.year), Number(found.month), Number(found.day));
}
