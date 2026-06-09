# CLAUDE.md

このファイルは Claude Code がこのリポジトリで作業する際のガイドラインです。

## プロジェクト概要

Claude と Obsidian を連携させた個人用ナレッジベース。

## フォルダ構成

```
claude/
  diary/          # 日記・作業ログ
  知識の保管庫/   # 学習メモ・調査まとめ
.obsidian/        # Obsidian 設定ファイル
```

## 作業ルール

- `claude/` 配下のMarkdownファイルがメインコンテンツ
- `.obsidian/` の設定ファイルは直接編集しない（Obsidian UIから変更する）
- ファイル名・見出しは日本語でOK

## プラグイン

- **realclaudian** — Claude と Obsidian をつなぐカスタムプラグイン（`.obsidian/plugins/realclaudian/`）
