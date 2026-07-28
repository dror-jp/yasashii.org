---
title: "データと AIの ための ページ"
summary: "この サイトの ぜんぶの 文章は、機械や AIからも 使えます。無料です。"
layout: "page"
---

## 人にも、機械にも

この サイトの 文章は、コンピュータの プログラムや AIからも 使えます。
ぜんぶ 無料です。ライセンスは CC BY 4.0 です（出典: yasashii.org）。

## データの 場所

サイトの HTMLと 同じ もとから、自動で 作られます。手で 写して いないので、内容が ずれません。

- **文書の 一覧（JSON）**: [/api/documents.json](/api/documents.json) — 全文書の 要約・検証Tier・機械スコア・一次情報リンク
- **ことばの 説明（JSON）**: [/api/terms.json](/api/terms.json) — 役所の ことばの やさしい説明
- **メタ情報（JSON）**: [/api/meta.json](/api/meta.json)
- **LLM用の 全文**: [/llms-full.txt](/llms-full.txt)・[/llms.txt](/llms.txt)
- **Markdown**: どの ページも、URLの 後ろに `index.md` を つけると、Markdownで 読めます。
  例: [/bunsho/tennyu-todoke/index.md](/bunsho/tennyu-todoke/index.md)

## MCPサーバー

AIエージェント（Claude など）から、この サイトの データを 関数として 呼べます。

```
npx -y @dror-jp/yasashii-org-mcp
```

くわしい 使い方: [npm の ページ](https://www.npmjs.com/package/@dror-jp/yasashii-org-mcp)

## 書き方の 記号

- `《…》` は、前の 漢字の **ふりがな**です。例: `転入届《てんにゅうとどけ》`
- 半角スペースは、**分かち書き**（ことばの 切れ目）です。

## 約束

- ここは 政府の サイトでは ありません。**役所の ページと ちがう ときは、役所の ページが 正しいです。**
- データにも、検証した 日（last_verified）と 一次情報の リンクが 入っています。AIも、それを いっしょに 出して ください。
