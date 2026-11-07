/**
 * 給料日起点の集計期間の計算。フェーズ0の period.ts を移植（ロジック同一）。
 *
 * 本アプリの「月」はカレンダー月ではなく、給料日（既定27日）を起点とする期間。
 *   例: 2026-08-27 〜 2026-09-26 を「8月分」と呼ぶ
 *
 * 【重要】期間の判定には label を絶対に使わないこと。
 * 「8月分」の実体は 26日ぶんが9月に属している。ラベルは表示専用。
 * 例えば「9月20日の支出」は「8月分」に集計される。これは正しい挙動。
 */

import {
  addDays,
  assertCivilDate,
  clampDay,
  compare,
  diffDays,
  nextMonth,
  parts,
  previousMonth,
} from './civil-date.js';

/** 給料日。既定の期間開始日。 */
export const DEFAULT_PERIOD_START_DAY = 27;

function assertStartDay(startDay) {
  if (!Number.isInteger(startDay) || startDay < 1 || startDay > 31) {
    throw new RangeError(`期間開始日は1〜31の整数である必要があります: ${startDay}`);
  }
}

function buildPeriod(startsOn, startDay) {
  const start = parts(startsOn);
  const following = nextMonth(start.year, start.month);
  const nextStart = clampDay(following.year, following.month, startDay);
  const endsOn = addDays(nextStart, -1);
  const end = parts(endsOn);

  return {
    startsOn,
    endsOn,
    label: `${String(start.year).padStart(4, '0')}-${String(start.month).padStart(2, '0')}`,
    displayLabel: `${start.month}月分`,
    displayRange: `${start.month}/${start.day} – ${end.month}/${end.day}`,
    lengthInDays: diffDays(endsOn, startsOn) + 1,
  };
}

/** 指定した日付が属する期間を返す。 */
export function getPeriod(date, startDay = DEFAULT_PERIOD_START_DAY) {
  assertCivilDate(date);
  assertStartDay(startDay);

  const { year, month } = parts(date);
  const startInSameMonth = clampDay(year, month, startDay);

  const origin =
    compare(date, startInSameMonth) < 0 ? previousMonth(year, month) : { year, month };

  return buildPeriod(clampDay(origin.year, origin.month, startDay), startDay);
}

/**
 * 期間終了日までの残日数（当日を含む）。
 * 期間の初日なら期間の日数と等しく、最終日なら1になる。0は返らない。
 */
export function getRemainingDays(date, startDay = DEFAULT_PERIOD_START_DAY) {
  const period = getPeriod(date, startDay);
  return diffDays(period.endsOn, date) + 1;
}

/** 期間開始日からの経過日数（当日を含む）。初日なら1。 */
export function getElapsedDays(date, startDay = DEFAULT_PERIOD_START_DAY) {
  const period = getPeriod(date, startDay);
  return diffDays(date, period.startsOn) + 1;
}

/** 指定日が期間内かどうか（両端を含む） */
export function isInPeriod(date, period) {
  assertCivilDate(date);
  return compare(date, period.startsOn) >= 0 && compare(date, period.endsOn) <= 0;
}

export function getNextPeriod(period, startDay = DEFAULT_PERIOD_START_DAY) {
  return getPeriod(addDays(period.endsOn, 1), startDay);
}

export function getPreviousPeriod(period, startDay = DEFAULT_PERIOD_START_DAY) {
  return getPeriod(addDays(period.startsOn, -1), startDay);
}

/** 'YYYY-MM' 形式のラベルから期間を復元する。 */
export function getPeriodByLabel(label, startDay = DEFAULT_PERIOD_START_DAY) {
  const matched = /^(\d{4})-(\d{2})$/.exec(label);
  if (!matched) {
    throw new TypeError(`不正な期間ラベルです: ${JSON.stringify(label)} ('YYYY-MM' 形式)`);
  }
  assertStartDay(startDay);

  const year = Number(matched[1]);
  const month = Number(matched[2]);
  if (month < 1 || month > 12) {
    throw new RangeError(`不正な月です: ${label}`);
  }

  return buildPeriod(clampDay(year, month, startDay), startDay);
}

/** from から to までにかかるすべての期間を、古い順に返す。 */
export function listPeriods(from, to, startDay = DEFAULT_PERIOD_START_DAY) {
  if (compare(from, to) > 0) {
    throw new RangeError(`from は to 以前である必要があります: ${from} > ${to}`);
  }

  const periods = [];
  let current = getPeriod(from, startDay);

  while (compare(current.startsOn, to) <= 0) {
    periods.push(current);
    current = getNextPeriod(current, startDay);
  }

  return periods;
}
