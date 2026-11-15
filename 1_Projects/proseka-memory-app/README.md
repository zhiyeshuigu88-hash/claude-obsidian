# プロセカ スコア管理アプリ

「プロジェクトセカイ」のプレイ結果を手入力で記録し、曲ごとのスコア推移やベスト記録を振り返るローカル Web アプリ。
データ(写真含む)はすべてローカルに保存し、外部送信は行いません。詳細仕様は [pjsk-score-tracker-requirements.md](pjsk-score-tracker-requirements.md) を参照。

## 起動

```bash
cd proseka-memory-app
npm install      # 初回のみ(express, multer)
npm start        # http://localhost:3003
```

ブラウザで `http://localhost:3003` を開く。

## 画面

- **一覧 (`/`)** — 全記録をカード表示。曲名の部分一致検索、プレイ日/スコア/曲名でのソート、
  「全履歴 / ベストのみ(曲+難易度ごと最高スコア)」の切替。各記録から編集・削除・グラフへ。
- **登録・編集 (`/form.html`)** — 結果画面の写真を1枚アップロード&プレビューしながら数値を手入力。
  判定数から FC(Miss=0)/ AP(全判定=0 かつ Perfect>0)を自動判定(手動上書き可)。曲名は既存値から補完。
- **曲別グラフ (`/graph.html`)** — 曲+難易度を選ぶとスコア推移を折れ線表示(Chart.js 同梱でオフライン動作)。
  点をクリックすると該当記録の編集へ。下部にベスト記録サマリと履歴一覧。

## データ

- 記録本体: `score-memory/records.json`(配列)
- 写真: `score-memory/photos/{id}.png`(JSON にはパスのみ保存)
- バックアップは `score-memory/` をコピーするだけ。
- 写真取り込みスキル `pjsk-score-photo-import` と同じ `score-memory/` を共有します。

## API

| メソッド | エンドポイント | 概要 |
|---|---|---|
| GET | `/api/records` | 全記録取得 |
| GET | `/api/records/:id` | 単一記録取得 |
| POST | `/api/records` | 新規登録(multipart/form-data, 写真任意) |
| PUT | `/api/records/:id` | 更新(写真差し替え・除去対応) |
| DELETE | `/api/records/:id` | 削除(写真ファイルも削除) |
| GET | `/photos/:filename` | 写真配信 |
