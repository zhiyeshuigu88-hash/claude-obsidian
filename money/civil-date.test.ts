import { describe, expect, it } from 'vitest';

import {
  addDays,
  clampDay,
  compare,
  daysInMonth,
  diffDays,
  isCivilDate,
  nextMonth,
  parts,
  previousMonth,
  toCivilDate,
  todayInTokyo,
} from './civil-date';

describe('isCivilDate', () => {
  it('正しい形式の実在する日付を受け入れる', () => {
    expect(isCivilDate('2026-08-27')).toBe(true);
    expect(isCivilDate('2024-02-29')).toBe(true); // うるう年
  });

  it('存在しない日付を弾く', () => {
    expect(isCivilDate('2025-02-29')).toBe(false); // 平年の2/29
    expect(isCivilDate('2026-04-31')).toBe(false); // 4月31日
    expect(isCivilDate('2026-13-01')).toBe(false);
    expect(isCivilDate('2026-00-10')).toBe(false);
  });

  it('形式違反を弾く', () => {
    expect(isCivilDate('2026-8-27')).toBe(false); // ゼロ埋めなし
    expect(isCivilDate('2026/08/27')).toBe(false);
    expect(isCivilDate('2026-08-27T00:00:00Z')).toBe(false);
    expect(isCivilDate('')).toBe(false);
    expect(isCivilDate(20260827)).toBe(false);
  });
});

describe('daysInMonth', () => {
  it('各月の日数を返す', () => {
    expect(daysInMonth(2026, 1)).toBe(31);
    expect(daysInMonth(2026, 4)).toBe(30);
    expect(daysInMonth(2026, 12)).toBe(31);
  });

  it('うるう年の2月を正しく扱う', () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2025, 2)).toBe(28);
    expect(daysInMonth(2000, 2)).toBe(29); // 400年ルール
    expect(daysInMonth(1900, 2)).toBe(28); // 100年ルール
  });
});

describe('clampDay', () => {
  it('存在する日はそのまま返す', () => {
    expect(clampDay(2026, 8, 27)).toBe('2026-08-27');
  });

  it('存在しない日を月末に丸める', () => {
    expect(clampDay(2026, 2, 31)).toBe('2026-02-28');
    expect(clampDay(2024, 2, 31)).toBe('2024-02-29');
    expect(clampDay(2026, 4, 31)).toBe('2026-04-30');
  });
});

describe('addDays', () => {
  it('日をまたぐ', () => {
    expect(addDays('2026-08-27', 1)).toBe('2026-08-28');
    expect(addDays('2026-08-27', -1)).toBe('2026-08-26');
    expect(addDays('2026-08-27', 0)).toBe('2026-08-27');
  });

  it('月をまたぐ', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01');
    expect(addDays('2026-09-01', -1)).toBe('2026-08-31');
  });

  it('年をまたぐ', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
  });

  it('うるう日をまたぐ', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2025-02-28', 1)).toBe('2025-03-01');
  });
});

describe('diffDays', () => {
  it('日数差を返す', () => {
    expect(diffDays('2026-09-26', '2026-08-27')).toBe(30);
    expect(diffDays('2026-08-27', '2026-08-27')).toBe(0);
    expect(diffDays('2026-08-26', '2026-08-27')).toBe(-1);
  });

  it('うるう年をまたいでも正確', () => {
    expect(diffDays('2024-03-01', '2024-02-28')).toBe(2);
    expect(diffDays('2025-03-01', '2025-02-28')).toBe(1);
  });
});

describe('compare', () => {
  it('時系列順で比較する', () => {
    expect(compare('2026-08-26', '2026-08-27')).toBe(-1);
    expect(compare('2026-08-27', '2026-08-27')).toBe(0);
    expect(compare('2026-08-28', '2026-08-27')).toBe(1);
  });

  it('年をまたいでも正しい', () => {
    expect(compare('2026-12-31', '2027-01-01')).toBe(-1);
  });
});

describe('previousMonth / nextMonth', () => {
  it('年をまたぐ', () => {
    expect(previousMonth(2026, 1)).toEqual({ year: 2025, month: 12 });
    expect(nextMonth(2026, 12)).toEqual({ year: 2027, month: 1 });
  });

  it('通常の月移動', () => {
    expect(previousMonth(2026, 8)).toEqual({ year: 2026, month: 7 });
    expect(nextMonth(2026, 8)).toEqual({ year: 2026, month: 9 });
  });
});

describe('todayInTokyo', () => {
  it('UTCの日中は同じ日付になる', () => {
    expect(todayInTokyo(new Date('2026-08-23T03:00:00Z'))).toBe('2026-08-23');
  });

  it('UTC 15時以降は日本時間で翌日になる', () => {
    // UTC 2026-08-23 16:00 = JST 2026-08-24 01:00
    expect(todayInTokyo(new Date('2026-08-23T16:00:00Z'))).toBe('2026-08-24');
  });

  it('UTCの深夜0時直後も日本時間では同日の朝', () => {
    // UTC 2026-08-23 00:30 = JST 2026-08-23 09:30
    expect(todayInTokyo(new Date('2026-08-23T00:30:00Z'))).toBe('2026-08-23');
  });

  it('日本時間の日付変更直前は前日のまま', () => {
    // UTC 2026-08-23 14:59 = JST 2026-08-23 23:59
    expect(todayInTokyo(new Date('2026-08-23T14:59:00Z'))).toBe('2026-08-23');
  });

  it('年またぎの境界', () => {
    // UTC 2026-12-31 15:00 = JST 2027-01-01 00:00
    expect(todayInTokyo(new Date('2026-12-31T15:00:00Z'))).toBe('2027-01-01');
  });
});

describe('toCivilDate / parts', () => {
  it('相互変換できる', () => {
    expect(toCivilDate(2026, 8, 27)).toBe('2026-08-27');
    expect(parts('2026-08-27')).toEqual({ year: 2026, month: 8, day: 27 });
  });

  it('存在しない日付は例外', () => {
    expect(() => toCivilDate(2025, 2, 29)).toThrow(TypeError);
  });
});
