# CLAUDE.md

このファイルは Claude Code がこのリポジトリで作業する際のガイドラインです。

## プロジェクト概要

Claude と Obsidian を連携させた個人用ナレッジベース。
学園アイドルマスターのサポートカード計算機のアプリ開発

## フォルダ構成（PARAメソッド）

```
1_Projects/     # 期限・完成目標のあるもの（memo-app / task-app / proseka-memory-app）
2_Areas/        # 継続して維持するもの（discord-bot / filament-keeper-web）
3_Resources/    # 参照用の知識・作品
  知識の保管庫/   # 学習メモ・調査まとめ
  音楽制作/       # 楽曲メモ
4_Archives/     # 使わなくなったもの（remote-case など）
claude/         # 手書き画像の保存先（attachments/）
.obsidian/      # Obsidian 設定ファイル
```

## 作業ルール

- 整理された知識メモは `3_Resources/知識の保管庫/` に置く
- Diary.md・掲示板.md・アイディアメモ.md は `1_Projects/memo-app/` 直下にある（server.js がこのパスを参照。手書き画像は `claude/attachments/`）
- `.obsidian/` の設定ファイルは直接編集しない（Obsidian UIから変更する）
- ファイル名・見出しは日本語でOK
- アプリを作る際はNode.jsを使うこと

## プラグイン

- **realclaudian** — Claude と Obsidian をつなぐカスタムプラグイン（`.obsidian/plugins/realclaudian/`）

