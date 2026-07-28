# {{ .Title }}

> Source: {{ .Permalink }} — yasashii.org（やさしい日本語の 案内サイト）。政府・役所《やくしょ》の サイトでは ありません。

{{ with .Params.summary }}{{ . }}
{{ end }}
{{ .RawContent }}
## ページの 一覧

{{ range .RegularPages }}- [{{ .Title }}]({{ .Permalink }}index.md){{ with .Params.summary }} — {{ . }}{{ end }}
{{ end }}
License: CC BY 4.0 — attribution: yasashii.org (DroR Corporation)
