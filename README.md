# yasashii.org

**Human-verified Easy Japanese (やさしい日本語) versions of Japanese administrative procedures and disaster-preparedness information.**

行政手続きと防災の情報を、やさしい日本語で書いた文書集です。国の一次情報をもとにゼロから書き、人が確認した日付を各文書に載せています。

> yasashii.org is **not** a government website. If anything differs from an official page, the official page is correct.
> Run by [DroR Corporation](https://dror.co.jp) (株式会社DroR) as a non-commercial, public-interest project. No ads.

- Site: https://yasashii.org
- 30 documents: administrative procedures (19), disaster preparedness and emergencies (10), daily life (1)
- Written to the Immigration Services Agency × Agency for Cultural Affairs guideline「在留支援のためのやさしい日本語ガイドライン」, with furigana (toggleable) and wakachi-gaki word breaks

## For AI agents

- **Remote MCP server** — `https://mcp.yasashii.org/mcp` (Streamable HTTP, no auth; source in [`remote-mcp/`](remote-mcp/))
- **MCP server** ([`mcp/`](mcp/)) — `npx -y @dror-jp/yasashii-org-mcp`
  ([npm](https://www.npmjs.com/package/@dror-jp/yasashii-org-mcp), official MCP Registry: `io.github.dror-jp/yasashii-org-mcp`).
  Dependency-free, no API key. Tools: `list_documents`, `get_document`, `search_terms`, `get_meta`.
- **API** — [`/api/documents.json`](https://yasashii.org/api/documents.json),
  [`/api/terms.json`](https://yasashii.org/api/terms.json),
  [`/api/meta.json`](https://yasashii.org/api/meta.json)
- Every document has a Markdown mirror at `{page_url}index.md`; indexes for LLMs at
  [`/llms.txt`](https://yasashii.org/llms.txt) and [`/llms-full.txt`](https://yasashii.org/llms-full.txt).
  Overview: [yasashii.org/data/](https://yasashii.org/data/)

Claude Code:

```bash
claude mcp add --transport http yasashii-org https://mcp.yasashii.org/mcp   # remote
claude mcp add yasashii-org -- npx -y @dror-jp/yasashii-org-mcp   # local
```

Claude Desktop and other MCP clients:

```json
{
  "mcpServers": {
    "yasashii-org": {
      "command": "npx",
      "args": ["-y", "@dror-jp/yasashii-org-mcp"]
    }
  }
}
```

## Reuse / 再利用

The text is CC BY 4.0. Local governments, schools and support groups may print, distribute and rewrite it for their area without asking — just credit "yasashii.org".

文章は CC BY 4.0 です。役所・学校・支援団体は、許可なく印刷・配布し、地域に合わせて書き換えられます。「出典: yasashii.org」と書いてください。

## Toolkit

[`kit/`](kit/) contains the conversion prompt, the rules extracted from the national guideline, and a machine checker (kuromoji-based) used to write and check every document. See [`kit/README.md`](kit/README.md).

## Development

Built with [Hugo](https://gohugo.io/) (extended).

```
hugo server                    # local preview
hugo                           # build to public/
pwsh scripts/Check-Links.ps1   # verify every source link
pwsh scripts/Run-Checker.ps1   # re-run the checker (npm ci in kit/checker first)
```

A GitHub Actions workflow rebuilds the site and re-verifies every source link weekly.

Corrections: fix@yasashii.org or a GitHub issue.

## License

- Code (templates, styles, scripts, `mcp/`, `kit/checker/`): [MIT](LICENSE)
- Text content (documents, API data, `kit/prompt-v1.md`, `kit/guideline-rules.md`): [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), attribution *yasashii.org (DroR Corporation)*
