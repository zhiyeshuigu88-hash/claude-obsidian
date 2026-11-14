/**
 * 「今日つかえる額」の算出。アプリの中核ロジック。
 *
 * 通常時:
 *   期間の変動費予算 = 期間予算 − 当期間の固定費合計
 *   残額             = 期間の変動費予算 − 当期間の変動費実績
 *   今日つかえる額   = 残額 ÷ 残日数
 *
 * 超過時（残額がマイナス）:
 *   日割りを行わず、超過額をそのまま返す。
 *
 *   理由: 超過額を残日数で割ると、支出がまったく増えていないのに
 *   日が経過するだけで表示額が悪化する。
 *   （3,000円の超過が、残10日なら-300円、残1日なら-3,000円と表示される）
 *   これは誤情報になるため、超過後は総額表示に切り替える。
 *
 * 注意: 予算額は光熱費を含まない。「このアプリで管理する範囲」の予算である。
 */

import { type CivilDate, todayInTokyo } from './civil-date';
import { DEFAULT_PERIOD_START_DAY, getRemainingDays } from './period';

export type AllowanceStatus = 'within' | 'over';

export interface AllowanceInput {
  /** 期間予算（固定費を含む総額） */
  periodBudget: number;
  /** 当期間に計上された固定費の合計 */
  fixedCostTotal: number;
  /** 当期間の変動費の実績合計 */
  variableSpent: number;
  /** 期間終了日までの残日数（当日を含む）。1以上。 */
  remainingDays: number;
}

export interface AllowanceResult {
  status: AllowanceStatus;
  /** 期間の変動費予算（予算 − 固定費） */
  variableBudget: number;
  /** 残額。超過時はマイナス。 */
  remaining: number;
  /** 今日つかえる額（円未満切り捨て）。超過時は null。 */
  dailyAllowance: number | null;
  /** 超過額（正の数）。通常時は0。 */
  overspent: number;
  /** 変動費予算の消化率。1.0 で使い切り。 */
  usageRate: number;
}

export function calculateAllowance(input: AllowanceInput): AllowanceResult {
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
    // 切り捨て。四捨五入だと予算をわずかに超える提示になりうるため。
    dailyAllowance: Math.floor(remaining / remainingDays),
    overspent: 0,
    usageRate,
  };
}

/** 日付から残日数を解決して算出する薄いラッパー。既定は日本時間の今日。 */
export function calculateAllowanceOn(
  input: Omit<AllowanceInput, 'remainingDays'>,
  date: CivilDate = todayInTokyo(),
  startDay: number = DEFAULT_PERIOD_START_DAY,
): AllowanceResult {
  return calculateAllowance({
    ...input,
    remainingDays: getRemainingDays(date, startDay),
  });
}
