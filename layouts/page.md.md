# {{ .Title }}

> Source: {{ .Permalink }} — yasashii.org（やさしい日本語の 案内サイト）。政府・役所《やくしょ》の サイトでは ありません。
> 《…》は ふりがな です。

{{ with .Params.summary }}{{ . }}
{{ end }}
{{ .RawContent }}

License: CC BY 4.0 — attribution: yasashii.org (DroR Corporation)
