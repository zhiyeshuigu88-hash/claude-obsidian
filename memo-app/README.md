# Folio（memo-app）

掲示板、アイディアメモ、日記をローカルで記録するNode.jsアプリです。
MarkdownファイルはUTF-8で保存されています。

## 起動方法

```powershell
npm start
```

起動後、ブラウザで以下を開きます。

```text
http://localhost:3001
```

## ターミナルで文字化けして見える場合

Windows PowerShellで日本語が文字化けして見える場合は、UTF-8を指定して読み取ります。

```powershell
Get-Content -Raw -Encoding UTF8 .\public\index.html
```

Markdownも同じように確認できます。

```powershell
Get-Content -Raw -Encoding UTF8 ..\claude\掲示板.md
Get-Content -Raw -Encoding UTF8 ..\claude\アイディアメモ.md
Get-Content -Raw -Encoding UTF8 ..\claude\Diary.md
```

それでも表示が崩れる場合は、端末の文字コードをUTF-8に寄せてから再度確認します。

```powershell
chcp 65001
```

この対応はターミナル表示用です。`memo-app` 本体とMarkdown本文はUTF-8のまま扱います。
