/**
 * 暦日（CivilDate）のプリミティブ操作。
 *
 * 設計方針:
 *   日付を `Date` ではなく 'YYYY-MM-DD' 形式の文字列として扱う。
 *   `Date` は内部にUTC時刻を持つため、「日付だけ」を扱いたい場面で
 *   タイムゾーン起因のズレ（深夜の入力が前日になる等）が混入する。
 *   文字列に閉じることで、期間計算を純粋な演算にする。
 *
 *   ISO形式（ゼロ埋め）のため、文字列の辞書順比較 = 時系列順比較になる。
 *   `a < b` がそのまま「aはbより前」を意味する。
 */

/** 'YYYY-MM-DD' 形式の暦日 */
export type CivilDate = string;

const CIVIL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export const TIME_ZONE = 'Asia/Tokyo';

export interface DateParts {
  /** 西暦年 */
  year: number;
  /** 1〜12 */
  month: number;
  /** 1〜31 */
  day: number;
}

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** 形式として妥当で、かつ実在する日付かどうか */
export function isCivilDate(value: unknown): value is CivilDate {
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

export function assertCivilDate(value: unknown): asserts value is CivilDate {
  if (!isCivilDate(value)) {
    throw new TypeError(
      `不正な暦日です: ${JSON.stringify(value)} ('YYYY-MM-DD' 形式の実在する日付が必要)`,
    );
  }
}

/** 年月日から暦日を組み立てる。実在しない日付は例外。 */
export function toCivilDate(year: number, month: number, day: number): CivilDate {
  const candidate = `${String(year).padStart(4, '0')}-${pad2(month)}-${pad2(day)}`;
  assertCivilDate(candidate);
  return candidate;
}

export function parts(date: CivilDate): DateParts {
  assertCivilDate(date);
  const matched = CIVIL_DATE_PATTERN.exec(date)!;
  return {
    year: Number(matched[1]),
    month: Number(matched[2]),
    day: Number(matched[3]),
  };
}

/** 指定年月の日数。month は 1〜12。 */
export function daysInMonth(year: number, month: number): number {
  // Date.UTC の day=0 は「前月の最終日」を指す
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * 指定日を、その月に存在する範囲へ丸めた暦日を返す。
 * 例: clampDay(2026, 2, 31) → '2026-02-28'
 *
 * 給料日が31日のように、月によって存在しない日を起点にする場合に必要。
 */
export function clampDay(year: number, month: number, day: number): CivilDate {
  if (!Number.isInteger(day) || day < 1) {
    throw new RangeError(`日は1以上の整数である必要があります: ${day}`);
  }
  const last = daysInMonth(year, month);
  return toCivilDate(year, month, Math.min(day, last));
}

const toUtcMs = (date: CivilDate): number => {
  const { year, month, day } = parts(date);
  return Date.UTC(year, month - 1, day);
};

const fromUtcMs = (ms: number): CivilDate => {
  const d = new Date(ms);
  return toCivilDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
};

const MS_PER_DAY = 86_400_000;

export function addDays(date: CivilDate, amount: number): CivilDate {
  if (!Number.isInteger(amount)) {
    throw new RangeError(`加算日数は整数である必要があります: ${amount}`);
  }
  return fromUtcMs(toUtcMs(date) + amount * MS_PER_DAY);
}

/** a - b を日数で返す。a が後なら正。 */
export function diffDays(a: CivilDate, b: CivilDate): number {
  return Math.round((toUtcMs(a) - toUtcMs(b)) / MS_PER_DAY);
}

/** a < b なら負、同じなら0、a > b なら正 */
export function compare(a: CivilDate, b: CivilDate): number {
  assertCivilDate(a);
  assertCivilDate(b);
  return a < b ? -1 : a > b ? 1 : 0;
}

/** 前月の年月 */
export function previousMonth(year: number, month: number): { year: number; month: number } {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

/** 翌月の年月 */
export function nextMonth(year: number, month: number): { year: number; month: number } {
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
}

/**
 * 日本時間における「今日」の暦日。
 *
 * タイムゾーンを意識するのはこの関数だけ。他のすべての計算は暦日文字列上で行う。
 * サーバー（VercelはUTC）でもブラウザ（端末のTZ依存）でも同じ結果になる。
 */
export function todayInTokyo(now: Date = new Date()): CivilDate {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const found: Record<string, string> = {};
  for (const part of formatter.formatToParts(now)) {
    if (part.type !== 'literal') found[part.type] = part.value;
  }

  return toCivilDate(Number(found.year), Number(found.month), Number(found.day));
}
