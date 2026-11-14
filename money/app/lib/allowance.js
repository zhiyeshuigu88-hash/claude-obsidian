/**
 * 「今日つかえる額」の算出。アプリの中核ロジック。フェーズ0の allowance.ts を移植。
 *
 * 通常時:
 *   期間の変動費予算 = 期間予算 − 当期間の固定費合計
 *   残額             = 期間の変動費予算 − 当期間の変動費実績
 *   今日つかえる額   = 残額 ÷ 残日数（円未満切り捨て）
 *
 * 超過時（残額がマイナス）:
 *   日割りを行わず、超過額をそのまま返す。
 *   （超過額を残日数で割ると、支出が増えていないのに日が経つだけで数字が悪化するため）
 */

import { todayInTokyo } from './civil-date.js';
import { DEFAULT_PERIOD_START_DAY, getRemainingDays } from './period.js';

export function calculateAllowance(input) {
  const { periodBudget, fixedCostTotal, variableSpent, remainingDays } = input;

  for (const [name, value] of Object.entries({
    periodBudget,
    fixedCostTotal,
    variableSpent,
  })) {
    if (!Number.isFinite(value)) {
      throw new TypeError(`${name} は有限の数値である必要があります: ${value}`);
    }
  }

  if (!Number.isInteger(remainingDays) || remainingDays < 1) {
    throw new RangeError(`残日数は1以上の整数である必要があります: ${remainingDays}`);
  }

  const variableBudget = periodBudget - fixedCostTotal;
  const remaining = variableBudget - variableSpent;
  const usageRate = variableBudget > 0 ? variableSpent / variableBudget : 0;

  if (remaining < 0) {
    return {
      status: 'over',
      variableBudget,
      remaining,
      dailyAllowance: null,
      overspent: -remaining,
      usageRate,
    };
  }

  return {
    status: 'within',
    variableBudget,
    remaining,
    dailyAllowance: Math.floor(remaining / remainingDays),
    overspent: 0,
    usageRate,
  };
}

/** 日付から残日数を解決して算出する薄いラッパー。既定は日本時間の今日。 */
export function calculateAllowanceOn(
  input,
  date = todayInTokyo(),
  startDay = DEFAULT_PERIOD_START_DAY,
) {
  return calculateAllowance({
    ...input,
    remainingDays: getRemainingDays(date, startDay),
  });
}
