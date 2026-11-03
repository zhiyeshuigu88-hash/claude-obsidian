# claude-obsidian

Claude と Obsidian を連携させた個人用ナレッジベースです。
あわせて、学園アイドルマスターのサポートカード計算機アプリを開発しています。

## 構成

```
claude/
  diary/          # 日記・作業ログ
  知識の保管庫/   # 学習メモ・調査まとめ
app/              # 学マス サポートカード計算機（Node.js / Electron）
.obsidian/        # Obsidian 設定ファイル
```

## 使い方

[Obsidian](https://obsidian.md) でこのフォルダを保管庫として開いてください。

## サポートカード計算機

Node.js が必要です。

```bash
cd app
npm install
npm run server   # ブラウザ版（http://localhost:3000）
npm start        # Electron デスクトップ版
```

## プラグイン

- **realclaudian** — Claude と Obsidian をつなぐカスタムプラグイン
