# {{ .Title }}

> Source: {{ .Permalink }} — yasashii.org（やさしい日本語の 案内サイト）。政府・役所《やくしょ》の サイトでは ありません。
> {{ if eq .Params.tier "verified" }}人が 確認《かくにん》しました: {{ .Params.last_verified }}。{{ else }}下書きです。まだ 人の 確認が 終わっていません。{{ end }}役所の ページと ちがう ときは、役所の ページが 正しいです。
> 《…》は ふりがな です。

{{ .Params.summary }}

{{ .RawContent }}
{{ with .Params.terms }}## ことばの せつめい

{{ range . }}- **{{ .word }}**（{{ .reading }}）: {{ .meaning }}
{{ end }}{{ end }}
{{ with .Params.source_links }}## もとの 情報（正しいのは こちら）

{{ range . }}- [{{ .label }}]({{ .url }}) — {{ .publisher }}（確認日 {{ .verified }}）
{{ end }}{{ end }}
License: CC BY 4.0 — attribution: yasashii.org (DroR Corporation)
