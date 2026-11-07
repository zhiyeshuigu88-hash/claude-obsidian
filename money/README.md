# 期間計算ユーティリティ

家計管理アプリ（要件定義書 v0.2）のフェーズ0成果物。
給料日起点の集計期間と「今日つかえる額」の計算を担う。

**テスト88件・strictモードの型チェックともに通過済み。**

## ファイル構成

| ファイル | 役割 |
|---|---|
| `lib/civil-date.ts` | 暦日（'YYYY-MM-DD'）のプリミティブ操作 |
| `lib/period.ts` | 27日始まりの期間計算 |
| `lib/allowance.ts` | 「今日つかえる額」の算出 |
| `lib/*.test.ts` | 各モジュールのテスト |

依存パッケージなし。Node.js標準の `Intl` と `Date.UTC` のみ使用。

## セットアップ

```bash
npm install -D vitest typescript
```

`package.json` に追記:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

Next.jsプロジェクトでは `lib/` 配下にそのまま置ける。

## 設計上の決定

### 1. 日付を `Date` ではなく文字列で扱う

`Date` は常にUTC時刻を内包するため、日付だけを扱いたい場面で
タイムゾーン起因のズレが混入する（深夜の入力が前日扱いになる等）。

`'YYYY-MM-DD'` 形式の文字列に閉じることで、期間計算が純粋な演算になる。
ISO形式のゼロ埋めなので、**文字列の辞書順比較がそのまま時系列順比較**になる。

タイムゾーンを意識するのは `todayInTokyo()` の1関数だけ。
ここだけテストすれば、Vercel（UTC）でもブラウザ（端末TZ依存）でも同じ結果が保証される。

### 2. 期間の判定に label を使わない

「8月分」の実体は `2026-08-27 〜 2026-09-26` であり、**26日ぶんが9月に属する**。
9月20日の支出は「8月分」に集計される。これは仕様どおりの正しい挙動。

ラベルから月を推測するコードを書くと必ずズレるため、
すべての判定・集計は `startsOn` / `endsOn` の実日付で行う。
`label` は表示とDBキーの用途のみ。

### 3. 期間の終了日を「次の開始日の前日」として求める

開始日を月末に丸めてから翌月の開始日を計算し、その前日を終了日とする。
この形にすると、給料日が31日のようなケースでも
**期間に隙間も重複も生じない**ことが構造的に保証される。

将来 `user_settings.period_start_day` を変更しても壊れない。
3年ぶんの全日付を走査して連続性を検証するプロパティテストを入れてある。

### 4. 超過時は日割りしない

`calculateAllowance` は残額がマイナスのとき `dailyAllowance: null` を返し、
`overspent` に超過額を正の数で入れる。

超過額を残日数で割ると、支出が増えていないのに日が経つだけで数字が悪化するため
（3,000円の超過が残10日で-300円、残1日で-3,000円と表示される）。
この決定に対する回帰テストを `allowance.test.ts` に入れてある。

## 使い方

```ts
import { todayInTokyo } from '@/lib/civil-date';
import { getPeriod, getRemainingDays } from '@/lib/period';
import { calculateAllowanceOn } from '@/lib/allowance';

const today = todayInTokyo();            // '2026-09-10'
const period = getPeriod(today);
// {
//   startsOn: '2026-08-27',
//   endsOn: '2026-09-26',
//   label: '2026-08',
//   displayLabel: '8月分',
//   displayRange: '8/27 – 9/26',
//   lengthInDays: 31
// }

getRemainingDays(today);                 // 17

const allowance = calculateAllowanceOn({
  periodBudget: 200_000,
  fixedCostTotal: 98_000,
  variableSpent: 42_800,
}, today);
// {
//   status: 'within',
//   variableBudget: 102_000,
//   remaining: 59_200,
//   dailyAllowance: 3_482,
//   overspent: 0,
//   usageRate: 0.4196...
// }
```

ホーム画面の分岐:

```tsx
{allowance.status === 'within' ? (
  <Amount label="今日つかえる" value={allowance.dailyAllowance} />
) : (
  <Amount label="予算を超過中" value={-allowance.overspent} tone="danger" />
)}
```

## 主なAPI

### `lib/civil-date.ts`

| 関数 | 説明 |
|---|---|
| `todayInTokyo(now?)` | 日本時間の今日 |
| `addDays(date, n)` / `diffDays(a, b)` | 日数の加算・差分 |
| `compare(a, b)` | 時系列比較 |
| `clampDay(y, m, d)` | 存在しない日を月末に丸める |
| `isCivilDate(v)` / `assertCivilDate(v)` | 検証 |

### `lib/period.ts`

| 関数 | 説明 |
|---|---|
| `getPeriod(date, startDay?)` | 日付が属する期間 |
| `getRemainingDays(date, startDay?)` | 残日数（当日含む、1以上） |
| `getElapsedDays(date, startDay?)` | 経過日数（当日含む） |
| `isInPeriod(date, period)` | 期間内判定 |
| `getNextPeriod` / `getPreviousPeriod` | 前後の期間 |
| `getPeriodByLabel(label, startDay?)` | ラベルから復元（DB連携用） |
| `listPeriods(from, to, startDay?)` | 期間セレクタの選択肢生成 |

### `lib/allowance.ts`

| 関数 | 説明 |
|---|---|
| `calculateAllowance(input)` | 残日数を渡して算出 |
| `calculateAllowanceOn(input, date?, startDay?)` | 日付から残日数を解決して算出 |

## テストが押さえている境界

- 27日 / 26日の切り替わり、月初、月末
- 年またぎ（12/27 → 1/26）
- うるう年（2024-02-29、期間長29日 vs 平年28日）
- 残日数が0以下にならないこと（400日ぶん連続検証）
- 3年間の全日付における期間の連続性（隙間・重複なし）
- 開始日を1 / 25 / 31日に変えても破綻しないこと
- UTC 15時境界でのタイムゾーン処理
- 超過時に日割りしないこと（v0.2決定事項の回帰テスト）

## 次のステップ

このユーティリティを前提に、Drizzleのスキーマ定義へ進める。
`budget_periods` の `starts_on` / `ends_on` / `label` は
`getPeriod()` の返り値をそのまま保存する形になる。
