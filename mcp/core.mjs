/**
 * yasashii-org-mcp core — shared by the stdio server (server.mjs) and the
 * remote Streamable HTTP server (../remote-mcp/). No Node-only imports here.
 *
 * createServer({ load, loadText }) returns { handle(msg) }: load(name) resolves to the
 * parsed /api/<name>.json, loadText(url) to the text at url (Markdown mirrors), and
 * handle() turns one JSON-RPC message into a response object (or null when none is due).
 */

export const VERSION = "1.1.3";
export const SUPPORTED_PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];

export const DISCLAIMER =
  "Source: yasashii.org — Easy Japanese (やさしい日本語) versions of Japanese administrative and disaster-preparedness information, " +
  "written from national primary sources and human-verified (NOT a government site). " +
  "If anything differs from an official government page, the official page is correct. " +
  "When answering the user, cite the source_links URL and mention the last_verified date. " +
  "Notation: 《…》 = furigana for the preceding kanji; half-width spaces = word breaks (wakachi-gaki).";


// Human-readable tool titles. Every tool only reads public data, so all carry the same
// read-only annotations (MCP tool annotations; required by some directories, and they let
// clients run the tools without a per-call confirmation).
export const TOOL_TITLES = {
  "list_documents": "List documents",
  "get_document": "Get a document",
  "search_terms": "Search terms",
  "get_meta": "Get API metadata"
};
const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

export function createServer({ load, loadText }) {
  const TOOLS = [
    {
      name: "list_documents",
      description:
        "List all Easy Japanese (やさしい日本語) documents on yasashii.org — Japanese administrative procedures (転入届, 国民健康保険, 国民年金, マイナンバーカード, 在留期間の更新...) and disaster preparedness (避難所, 119番...). Each has a stable ID, a one-line summary, and a verification tier.",
      inputSchema: {
        type: "object",
        properties: {
          category: { type: "string", enum: ["tetsuzuki", "bosai", "seikatsu"], description: "Optional filter: tetsuzuki = administrative procedures, bosai = disaster/emergency, seikatsu = daily life." },
        },
      },
      handler: async ({ category }) => {
        const d = await load("documents");
        const items = d.documents
          .filter((x) => !category || x.category === category)
          .map((x) => ({ id: x.id, category: x.category, title: x.title_plain, summary: x.summary, tier: x.tier, last_verified: x.last_verified }));
        return { count: items.length, documents: items };
      },
    },
    {
      name: "get_document",
      description:
        "Get one Easy Japanese document by ID: full Markdown body (with furigana in 《…》 and wakachi-gaki spacing, ready to hand to a reader), plain-Japanese term explanations, human-verified primary-source links (go.jp / e-Gov) and the last_verified date. Use list_documents first to find the ID.",
      inputSchema: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string", description: "Stable slug, e.g. 'tennyu-todoke'." } },
      },
      handler: async ({ id }) => {
        const d = await load("documents");
        const doc = d.documents.find((x) => x.id === id);
        if (!doc) {
          return { error: `Unknown id '${id}'.`, available_ids: d.documents.map((x) => x.id) };
        }
        let markdown = null;
        try {
          markdown = await loadText(doc.url_md);
        } catch {
          // Markdownミラーが取れなくてもメタデータは返す
        }
        return { ...doc, markdown };
      },
    },
    {
      name: "search_terms",
      description:
        "Look up Japanese administrative terms (住民票, 転入届, 保険料, 避難所...) and get their Easy Japanese (やさしい日本語) explanations — plain wording a non-native reader can understand. Matches the term, its reading, or words inside the explanation.",
      inputSchema: {
        type: "object",
        required: ["query"],
        properties: { query: { type: "string" } },
      },
      handler: async ({ query }) => {
        const d = await load("terms");
        const q = (query ?? "").trim();
        const hits = d.terms.filter(
          (t) => t.word.includes(q) || (t.reading ?? "").includes(q) || (t.meaning ?? "").includes(q)
        );
        return hits.length ? { matches: hits } : { matches: [], hint: "No match. Try the Japanese term (e.g. 住民票) or its reading in hiragana." };
      },
    },
    {
      name: "get_meta",
      description:
        "Get API metadata for yasashii.org: all endpoints, the oldest verification date across documents, license and attribution.",
      inputSchema: { type: "object", properties: {} },
      handler: async () => load("meta"),
    },
  ];

  const ok = (id, result) => ({ jsonrpc: "2.0", id, result });
  const err = (id, code, message) => ({ jsonrpc: "2.0", id, error: { code, message } });

  async function handle(msg) {
    if (!msg || typeof msg !== "object" || msg.jsonrpc !== "2.0") return err(null, -32600, "Invalid Request");
    const { id, method, params } = msg;
    const isNotification = id === undefined;
    // Responses from the client (to server requests we never send) are ignored.
    if (method === undefined && ("result" in msg || "error" in msg)) return null;
    // A message without an id is a notification: never answered.
    if (isNotification) return null;
    try {
      if (method === "initialize") {
        const requested = params?.protocolVersion;
        return ok(id, {
          protocolVersion: SUPPORTED_PROTOCOL_VERSIONS.includes(requested) ? requested : SUPPORTED_PROTOCOL_VERSIONS[0],
          capabilities: { tools: {} },
          serverInfo: { name: "yasashii-org", title: "yasashii.org", version: VERSION },
          instructions:
            "Human-verified Easy Japanese (やさしい日本語) versions of Japanese administrative and disaster information. " + DISCLAIMER,
        });
      }
      if (method === "ping") return ok(id, {});
      if (method === "tools/list") {
        return ok(id, {
          tools: TOOLS.map(({ name, description, inputSchema }) => ({
            name,
            title: TOOL_TITLES[name],
            description,
            inputSchema,
            annotations: { title: TOOL_TITLES[name], ...READ_ONLY },
          })),
        });
      }
      if (method === "tools/call") {
        const tool = TOOLS.find((t) => t.name === params?.name);
        if (!tool) return err(id, -32602, `Unknown tool: ${params?.name}`);
        let result;
        try {
          result = await tool.handler(params?.arguments ?? {});
        } catch (e) {
          // Tool execution errors (bad arguments, data fetch failures) go back as a tool result
          // with isError so the model can see and correct them.
          const text = `Error in ${tool.name}: ${e.message}. Check the arguments against the inputSchema (tools/list).`;
          return ok(id, { content: [{ type: "text", text }], isError: true });
        }
        const payload = { ...result, _disclaimer: DISCLAIMER, _license: "CC BY 4.0 — attribution: yasashii.org (DroR Corporation)" };
        return ok(id, { content: [{ type: "text", text: JSON.stringify(payload) }], isError: false });
      }
      return err(id, -32601, `Method not found: ${method}`);
    } catch (e) {
      return err(id, -32603, e.message);
    }
  }

  return { handle, tools: TOOLS };
}
