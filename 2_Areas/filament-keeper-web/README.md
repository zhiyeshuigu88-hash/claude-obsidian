# Filament Keeper（Next.js版）

3Dプリンター用フィラメントの **残量・状態・コスト** を一元管理する、個人用のローカルWebアプリです。
[要件定義書 v2.0](../../Downloads/filament-manager-requirements-v2.md) の **Phase 1**（F-01〜F-05, F-14）を実装しています。

- 対象プリンター: Bambu Lab A1 mini（他機種も登録可）
- 想定利用者: 個人（単一ユーザー・単一端末・認証なし）
- データは `data/filament.db`（SQLite）にのみ保存され、`127.0.0.1` 以外へは通信しません

---

## セットアップ・起動

初回のみ依存関係をインストールします。

```bash
npm install
```

開発サーバー（ホットリロードあり）:

```bash
npm run dev
```

本番ビルドして起動（`start.bat` をダブルクリックするのと同じ内容）:

```bash
npm run build
npm run start
```

`npm run start` は `127.0.0.1:3000` のみで待ち受けます。ブラウザで
[http://127.0.0.1:3000](http://127.0.0.1:3000) を開いてください。

---

## 実装範囲（Phase 1）

| ID | 機能 |
|---|---|
| F-01 | フィラメント登録・編集・論理削除、「同じスプールをもう1本登録」 |
| F-02 | 一覧（カード/テーブル切替、素材・ステータスのフィルタ、3種のソート、検索） |
| F-03 | 残量の更新（方式A: 使用量を引く / 方式B: 実測総重量から算出、スプール自重の上書き） |
| F-04 | 印刷ジョブの記録（複数フィラメント対応、残量減算と材料費算出を同一トランザクションで実行） |
| F-05 | ホームダッシュボード（サマリー・直近5件の印刷ジョブ・クイックアクション） |
| F-14 | 自動バックアップ（起動時に直近7世代を保持）・手動バックアップ |

プロファイル管理（S-08）と設定画面（S-09、バックアップのみ）も実装済みです。
保管場所・乾燥ログ・残量アラート・統計・印刷設定メモ（F-06〜F-09, F-11）は Phase 2 で未実装です。
データモデルは要件定義書6章の全テーブルを先に定義していますが、Phase 2向けの列・テーブルは
現時点では未使用です。

### キーボードショートカット

| キー | 動作 |
|---|---|
| `N` | 印刷ジョブ登録を開く |
| `F` | フィラメント登録を開く |
| `/` | フィラメント一覧の検索欄にフォーカス |
| `Esc` | モーダルを閉じる |

---

## 技術スタック

Next.js 15/16 (App Router) / TypeScript / better-sqlite3 / Drizzle ORM /
Tailwind CSS + shadcn/ui (base-nova, base-ui/react) / React Hook Form + Zod / next-themes

## 構成

```
src/
  app/                    ページ（App Router）
  components/             UIコンポーネント（shadcn/ui + 独自コンポーネント）
  lib/db/schema.ts         Drizzleスキーマ（要件定義書6章の全テーブル）
  lib/db/client.ts         better-sqlite3接続 + マイグレーション実行
  lib/db/backup.ts         F-14: バックアップの作成・世代管理
  lib/queries.ts           読み取り専用クエリ
  lib/actions/             Server Actions（作成・更新・削除）
  lib/calc.ts              単価・残量%等の算出関数（DBに保持しない値）
instrumentation.ts          サーバー起動時フック（マイグレーション + 自動バックアップ）
drizzle/                    drizzle-kit generate が出力するマイグレーションSQL
data/                       filament.db 本体とバックアップ（gitignore対象）
```
