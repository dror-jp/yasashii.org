# yasashii.org — 役所の 情報を、やさしい 日本語で。

> Source: {{ .Permalink }} — yasashii.org は、政府・役所《やくしょ》の サイトでは ありません。
> 役所の ページと ちがう ときは、役所の ページが 正しいです。
> 《…》は ふりがな です。

{{ .RawContent }}

## 文書の 一覧

{{ range where site.RegularPages "Section" "bunsho" }}- [{{ .Title }}]({{ .Permalink }}index.md){{ with .Params.summary }} — {{ . }}{{ end }}
{{ end }}
## Machine-readable

- JSON API: {{ "api/documents.json" | absURL }} / {{ "api/terms.json" | absURL }} / {{ "api/meta.json" | absURL }}
- Full text: {{ "llms-full.txt" | absURL }}

License: CC BY 4.0 — attribution: yasashii.org (DroR Corporation)
