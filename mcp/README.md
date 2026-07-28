# @dror-jp/yasashii-org-mcp

[yasashii.org](https://yasashii.org/) の MCP (Model Context Protocol) サーバーです。
行政手続き・防災情報の「やさしい日本語」版（国の一次情報から執筆し、人が検証・CC BY 4.0）を、AIエージェントが関数として呼べます。依存パッケージゼロ。

MCP server for yasashii.org — human-verified Easy Japanese (やさしい日本語) versions of
Japanese administrative procedures and disaster-preparedness information. Zero dependencies.

## Setup

Claude Code:

```bash
claude mcp add yasashii-org -- npx -y @dror-jp/yasashii-org-mcp
```

Claude Desktop (`claude_desktop_config.json`):

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

## Tools

| Tool | 説明 |
|---|---|
| `list_documents(category?)` | 文書一覧（id・要約・検証Tier）。`tetsuzuki` = 行政手続き / `bosai` = 防災 |
| `get_document(id)` | 文書の本文（ふりがな《》・分かち書きつきMarkdown）・用語説明・検証済み一次情報リンク |
| `search_terms(query)` | 役所のことば（住民票、転入届…）のやさしい日本語での説明 |
| `get_meta()` | APIメタ情報 |

## Design rules

- Every response includes a disclaimer and `last_verified` dates.
- Primary-source links (go.jp / e-Gov) are returned as-is — cite them in answers.
- `《…》` is furigana for the preceding kanji; half-width spaces are wakachi-gaki word breaks
  (per the Immigration Services Agency × Agency for Cultural Affairs guideline).
- yasashii.org is **not** a government website. If anything differs from an official page,
  the official page is correct.

## Data

Generated at build time from the site source (never hand-synced):
https://yasashii.org/api/documents.json / terms.json / meta.json

License: content CC BY 4.0 (attribution: yasashii.org, DroR Corporation) / code MIT
