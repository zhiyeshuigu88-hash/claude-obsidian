import { describe, expect, it } from 'vitest';

import { calculateAllowance, calculateAllowanceOn } from './allowance';

const base = {
  periodBudget: 200_000,
  fixedCostTotal: 98_000,
  variableSpent: 42_800,
  remainingDays: 18,
};

describe('calculateAllowance: 通常時', () => {
  it('固定費を除いた変動費予算を残日数で割る', () => {
    const result = calculateAllowance(base);
    expect(result.status).toBe('within');
    expect(result.variableBudget).toBe(102_000);
    expect(result.remaining).toBe(59_200);
    expect(result.dailyAllowance).toBe(3_288); // 59200 / 18 = 3288.88... → 切り捨て
    expect(result.overspent).toBe(0);
  });

  it('円未満は切り捨てる（四捨五入しない）', () => {
    const result = calculateAllowance({
      periodBudget: 100,
      fixedCostTotal: 0,
      variableSpent: 0,
      remainingDays: 3,
    });
    // 33.33... を四捨五入すると33、切り上げると34。切り捨てで33。
    expect(result.dailyAllowance).toBe(33);
  });

  it('ちょうど使い切った状態は超過ではない', () => {
    const result = calculateAllowance({
      ...base,
      variableSpent: 102_000,
    });
    expect(result.status).toBe('within');
    expect(result.remaining).toBe(0);
    expect(result.dailyAllowance).toBe(0);
    expect(result.overspent).toBe(0);
    expect(result.usageRate).toBe(1);
  });

  it('期間初日は変動費予算を丸ごと日割りする', () => {
    const result = calculateAllowance({
      periodBudget: 200_000,
      fixedCostTotal: 98_000,
      variableSpent: 0,
      remainingDays: 31,
    });
    expect(result.dailyAllowance).toBe(3_290); // 102000 / 31 = 3290.32...
  });

  it('節約すると翌日以降の使える額が増える', () => {
    const spentLittle = calculateAllowance({ ...base, variableSpent: 30_000 });
    const spentMore = calculateAllowance({ ...base, variableSpent: 60_000 });
    expect(spentLittle.dailyAllowance!).toBeGreaterThan(spentMore.dailyAllowance!);
  });
});

describe('calculateAllowance: 超過時', () => {
  const over = {
    periodBudget: 200_000,
    fixedCostTotal: 98_000,
    variableSpent: 105_120,
    remainingDays: 6,
  };

  it('状態が over になり、超過額を正の数で返す', () => {
    const result = calculateAllowance(over);
    expect(result.status).toBe('over');
    expect(result.remaining).toBe(-3_120);
    expect(result.overspent).toBe(3_120);
  });

  it('超過時は日割りせず dailyAllowance は null', () => {
    expect(calculateAllowance(over).dailyAllowance).toBeNull();
  });

  /**
   * v0.2の決定事項に対する回帰テスト。
   * 超過額を残日数で割る実装に戻すと、支出が変わらないのに
   * 日が経つだけで数字が悪化する。それが起きないことを保証する。
   */
  it('支出が同じなら、残日数が減っても超過額は変わらない', () => {
    const amounts = [10, 5, 1].map(
      (remainingDays) => calculateAllowance({ ...over, remainingDays }).overspent,
    );
    expect(amounts).toEqual([3_120, 3_120, 3_120]);
  });

  it('1円でも超えたら over になる', () => {
    const result = calculateAllowance({ ...base, variableSpent: 102_001 });
    expect(result.status).toBe('over');
    expect(result.overspent).toBe(1);
  });

  it('固定費だけで予算を超えている場合も検出する', () => {
    const result = calculateAllowance({
      periodBudget: 90_000,
      fixedCostTotal: 98_000,
      variableSpent: 0,
      remainingDays: 20,
    });
    expect(result.status).toBe('over');
    expect(result.variableBudget).toBe(-8_000);
    expect(result.overspent).toBe(8_000);
  });
});

describe('calculateAllowance: 消化率', () => {
  it('半分使ったら0.5', () => {
    const result = calculateAllowance({ ...base, variableSpent: 51_000 });
    expect(result.usageRate).toBe(0.5);
  });

  it('変動費予算が0以下でもゼロ除算しない', () => {
    const result = calculateAllowance({
      periodBudget: 98_000,
      fixedCostTotal: 98_000,
      variableSpent: 5_000,
      remainingDays: 10,
    });
    expect(Number.isFinite(result.usageRate)).toBe(true);
    expect(result.usageRate).toBe(0);
  });
});

describe('calculateAllowance: 入力の検証', () => {
  it('残日数が0以下なら例外', () => {
    expect(() => calculateAllowance({ ...base, remainingDays: 0 })).toThrow(RangeError);
    expect(() => calculateAllowance({ ...base, remainingDays: -1 })).toThrow(RangeError);
  });

  it('残日数が整数でなければ例外', () => {
    expect(() => calculateAllowance({ ...base, remainingDays: 1.5 })).toThrow(RangeError);
  });

  it('数値でない金額は例外', () => {
    expect(() => calculateAllowance({ ...base, periodBudget: NaN })).toThrow(TypeError);
    expect(() => calculateAllowance({ ...base, variableSpent: Infinity })).toThrow(TypeError);
  });
});

describe('calculateAllowanceOn', () => {
  const budget = {
    periodBudget: 200_000,
    fixedCostTotal: 98_000,
    variableSpent: 42_800,
  };

  it('日付から残日数を解決する', () => {
    // 2026-09-10 の残日数は17日
    const result = calculateAllowanceOn(budget, '2026-09-10');
    expect(result.dailyAllowance).toBe(Math.floor(59_200 / 17));
  });

  it('期間の最終日は残額がそのまま今日つかえる額になる', () => {
    const result = calculateAllowanceOn(budget, '2026-09-26');
    expect(result.dailyAllowance).toBe(59_200);
  });

  it('期間の初日は変動費予算を日数で割る', () => {
    const result = calculateAllowanceOn({ ...budget, variableSpent: 0 }, '2026-08-27');
    expect(result.dailyAllowance).toBe(Math.floor(102_000 / 31));
  });
});
