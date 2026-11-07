import { describe, expect, it } from 'vitest';

import { addDays, compare, diffDays } from './civil-date';
import {
  DEFAULT_PERIOD_START_DAY,
  getElapsedDays,
  getNextPeriod,
  getPeriod,
  getPeriodByLabel,
  getPreviousPeriod,
  getRemainingDays,
  isInPeriod,
  listPeriods,
} from './period';

describe('DEFAULT_PERIOD_START_DAY', () => {
  it('給料日の27日である', () => {
    expect(DEFAULT_PERIOD_START_DAY).toBe(27);
  });
});

describe('getPeriod: 基本の境界', () => {
  it('27日は新しい期間の初日になる', () => {
    const period = getPeriod('2026-08-27');
    expect(period.startsOn).toBe('2026-08-27');
    expect(period.endsOn).toBe('2026-09-26');
  });

  it('26日は期間の最終日になる', () => {
    const period = getPeriod('2026-09-26');
    expect(period.startsOn).toBe('2026-08-27');
    expect(period.endsOn).toBe('2026-09-26');
  });

  it('27日の前日は前の期間に属する', () => {
    const period = getPeriod('2026-08-26');
    expect(period.startsOn).toBe('2026-07-27');
    expect(period.endsOn).toBe('2026-08-26');
  });

  it('月初は前月開始の期間に属する', () => {
    const period = getPeriod('2026-09-01');
    expect(period.startsOn).toBe('2026-08-27');
    expect(period.endsOn).toBe('2026-09-26');
  });

  it('期間の中盤', () => {
    const period = getPeriod('2026-09-10');
    expect(period.startsOn).toBe('2026-08-27');
    expect(period.endsOn).toBe('2026-09-26');
  });
});

describe('getPeriod: ラベル（開始月基準）', () => {
  it('8/27〜9/26 は「8月分」', () => {
    const period = getPeriod('2026-08-27');
    expect(period.label).toBe('2026-08');
    expect(period.displayLabel).toBe('8月分');
    expect(period.displayRange).toBe('8/27 – 9/26');
  });

  it('9月20日の支出も「8月分」に属する（仕様どおり）', () => {
    const period = getPeriod('2026-09-20');
    expect(period.displayLabel).toBe('8月分');
    expect(period.label).toBe('2026-08');
  });

  it('9/27以降は「9月分」に切り替わる', () => {
    const period = getPeriod('2026-09-27');
    expect(period.label).toBe('2026-09');
    expect(period.displayLabel).toBe('9月分');
    expect(period.startsOn).toBe('2026-09-27');
    expect(period.endsOn).toBe('2026-10-26');
  });

  it('1月分のラベルは前年12月にならない', () => {
    const period = getPeriod('2027-01-15');
    expect(period.label).toBe('2026-12');
    expect(period.displayLabel).toBe('12月分');
  });
});

describe('getPeriod: 年またぎ', () => {
  it('12月27日から新しい期間が始まる', () => {
    const period = getPeriod('2026-12-27');
    expect(period.startsOn).toBe('2026-12-27');
    expect(period.endsOn).toBe('2027-01-26');
  });

  it('元日は前年12月開始の期間に属する', () => {
    const period = getPeriod('2027-01-01');
    expect(period.startsOn).toBe('2026-12-27');
    expect(period.endsOn).toBe('2027-01-26');
  });

  it('1月27日で年内最初の期間に切り替わる', () => {
    const period = getPeriod('2027-01-27');
    expect(period.startsOn).toBe('2027-01-27');
    expect(period.endsOn).toBe('2027-02-26');
  });
});

describe('getPeriod: うるう年', () => {
  it('うるう日は2月開始の期間に属する', () => {
    const period = getPeriod('2024-02-29');
    expect(period.startsOn).toBe('2024-02-27');
    expect(period.endsOn).toBe('2024-03-26');
  });

  it('うるう年の1月分は29日間', () => {
    // 2024-01-27 〜 2024-02-26
    expect(getPeriod('2024-02-01').lengthInDays).toBe(31);
    // 2024-02-27 〜 2024-03-26（2月が29日あるぶん長い）
    expect(getPeriod('2024-03-01').lengthInDays).toBe(29);
  });

  it('平年の2月分は28日間', () => {
    // 2025-02-27 〜 2025-03-26
    expect(getPeriod('2025-03-01').lengthInDays).toBe(28);
  });
});

describe('getPeriod: 期間の長さ', () => {
  it('8月分は31日間', () => {
    expect(getPeriod('2026-08-27').lengthInDays).toBe(31);
  });

  it('9月分は30日間', () => {
    // 2026-09-27 〜 2026-10-26
    expect(getPeriod('2026-09-27').lengthInDays).toBe(30);
  });
});

describe('getRemainingDays', () => {
  it('初日は期間の日数と等しい', () => {
    expect(getRemainingDays('2026-08-27')).toBe(31);
  });

  it('最終日は1', () => {
    expect(getRemainingDays('2026-09-26')).toBe(1);
  });

  it('中盤の日', () => {
    // 9/10 から 9/26 まで、当日含めて17日
    expect(getRemainingDays('2026-09-10')).toBe(17);
  });

  it('けっして0以下にならない', () => {
    let date = '2026-08-27';
    for (let i = 0; i < 400; i += 1) {
      expect(getRemainingDays(date)).toBeGreaterThanOrEqual(1);
      date = addDays(date, 1);
    }
  });
});

describe('getElapsedDays', () => {
  it('初日は1', () => {
    expect(getElapsedDays('2026-08-27')).toBe(1);
  });

  it('最終日は期間の日数と等しい', () => {
    expect(getElapsedDays('2026-09-26')).toBe(31);
  });

  it('経過日数 + 残日数 - 1 = 期間の日数', () => {
    const date = '2026-09-10';
    const period = getPeriod(date);
    expect(getElapsedDays(date) + getRemainingDays(date) - 1).toBe(period.lengthInDays);
  });
});

describe('isInPeriod', () => {
  const period = getPeriod('2026-08-27');

  it('両端を含む', () => {
    expect(isInPeriod('2026-08-27', period)).toBe(true);
    expect(isInPeriod('2026-09-26', period)).toBe(true);
  });

  it('範囲外を除外する', () => {
    expect(isInPeriod('2026-08-26', period)).toBe(false);
    expect(isInPeriod('2026-09-27', period)).toBe(false);
  });
});

describe('getNextPeriod / getPreviousPeriod', () => {
  it('次の期間は現在の終了日の翌日から始まる', () => {
    const period = getPeriod('2026-08-27');
    const next = getNextPeriod(period);
    expect(next.startsOn).toBe('2026-09-27');
    expect(next.startsOn).toBe(addDays(period.endsOn, 1));
  });

  it('前の期間は現在の開始日の前日に終わる', () => {
    const period = getPeriod('2026-08-27');
    const previous = getPreviousPeriod(period);
    expect(previous.endsOn).toBe('2026-08-26');
    expect(previous.endsOn).toBe(addDays(period.startsOn, -1));
  });

  it('往復して元に戻る', () => {
    const period = getPeriod('2026-08-27');
    expect(getPreviousPeriod(getNextPeriod(period))).toEqual(period);
  });

  it('年をまたいで往復できる', () => {
    const period = getPeriod('2026-12-27');
    expect(getPreviousPeriod(getNextPeriod(period))).toEqual(period);
  });
});

describe('getPeriodByLabel', () => {
  it('ラベルから期間を復元する', () => {
    const period = getPeriodByLabel('2026-08');
    expect(period.startsOn).toBe('2026-08-27');
    expect(period.endsOn).toBe('2026-09-26');
  });

  it('getPeriod の結果と一致する', () => {
    const fromDate = getPeriod('2026-09-05');
    expect(getPeriodByLabel(fromDate.label)).toEqual(fromDate);
  });

  it('不正なラベルは例外', () => {
    expect(() => getPeriodByLabel('2026-8')).toThrow(TypeError);
    expect(() => getPeriodByLabel('2026-13')).toThrow(RangeError);
    expect(() => getPeriodByLabel('')).toThrow(TypeError);
  });
});

describe('listPeriods', () => {
  it('範囲にかかる期間をすべて返す', () => {
    const periods = listPeriods('2026-08-27', '2026-10-26');
    expect(periods.map((p) => p.label)).toEqual(['2026-08', '2026-09']);
  });

  it('範囲の端にかかる期間も含む', () => {
    const periods = listPeriods('2026-09-26', '2026-09-27');
    expect(periods.map((p) => p.label)).toEqual(['2026-08', '2026-09']);
  });

  it('同一日なら1件', () => {
    expect(listPeriods('2026-09-10', '2026-09-10')).toHaveLength(1);
  });

  it('from が to より後なら例外', () => {
    expect(() => listPeriods('2026-09-10', '2026-09-01')).toThrow(RangeError);
  });
});

describe('期間の連続性（プロパティテスト）', () => {
  it('3年間のどの日も、ちょうど1つの期間に属し、期間に隙間も重複もない', () => {
    let date = '2025-01-01';
    const last = '2028-01-01';
    let previous = getPeriod(date);

    while (compare(date, last) <= 0) {
      const period = getPeriod(date);

      // 自分が属する期間の中に必ず含まれる
      expect(isInPeriod(date, period)).toBe(true);

      if (period.label !== previous.label) {
        // 期間が切り替わったら、前の期間の翌日から始まっている（隙間なし・重複なし）
        expect(period.startsOn).toBe(addDays(previous.endsOn, 1));
        previous = period;
      }

      date = addDays(date, 1);
    }
  });

  it('どの期間も長さが28〜31日に収まる', () => {
    for (const period of listPeriods('2024-01-01', '2028-01-01')) {
      expect(period.lengthInDays).toBeGreaterThanOrEqual(28);
      expect(period.lengthInDays).toBeLessThanOrEqual(31);
      expect(diffDays(period.endsOn, period.startsOn) + 1).toBe(period.lengthInDays);
    }
  });
});

describe('開始日のカスタマイズ（将来の給料日変更に備える）', () => {
  it('1日始まりならカレンダー月と一致する', () => {
    const period = getPeriod('2026-08-15', 1);
    expect(period.startsOn).toBe('2026-08-01');
    expect(period.endsOn).toBe('2026-08-31');
  });

  it('25日始まり', () => {
    const period = getPeriod('2026-08-25', 25);
    expect(period.startsOn).toBe('2026-08-25');
    expect(period.endsOn).toBe('2026-09-24');
  });

  it('31日始まりでも2月で破綻しない（月末に丸める）', () => {
    const period = getPeriod('2026-02-15', 31);
    expect(period.startsOn).toBe('2026-01-31');
    expect(period.endsOn).toBe('2026-02-27');
  });

  it('31日始まりでも期間が連続する', () => {
    let date = '2025-01-01';
    let previous = getPeriod(date, 31);

    for (let i = 0; i < 800; i += 1) {
      const period = getPeriod(date, 31);
      expect(isInPeriod(date, period)).toBe(true);
      if (period.label !== previous.label) {
        expect(period.startsOn).toBe(addDays(previous.endsOn, 1));
        previous = period;
      }
      date = addDays(date, 1);
    }
  });

  it('範囲外の開始日は例外', () => {
    expect(() => getPeriod('2026-08-27', 0)).toThrow(RangeError);
    expect(() => getPeriod('2026-08-27', 32)).toThrow(RangeError);
    expect(() => getPeriod('2026-08-27', 27.5)).toThrow(RangeError);
  });
});

describe('入力の検証', () => {
  it('不正な日付は例外', () => {
    expect(() => getPeriod('2026-8-27')).toThrow(TypeError);
    expect(() => getPeriod('2025-02-29')).toThrow(TypeError);
    expect(() => getPeriod('')).toThrow(TypeError);
  });
});
