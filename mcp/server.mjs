#!/usr/bin/env node
/**
 * yasashii-org-mcp — yasashii.org の MCP サーバー(依存パッケージゼロ)
 *
 * Model Context Protocol (stdio / JSON-RPC 2.0) を素の Node.js で実装。
 * 行政手続き・防災情報の「やさしい日本語」版(人間検証済み・CC BY)を関数として呼べる。
 *
 * 使い方:
 *   node server.mjs                      # 本番: https://yasashii.org/api/ から取得(1時間キャッシュ)
 *   node server.mjs --data ./local-dir   # 開発: ローカルの documents.json / terms.json を読む
 *
 * Claude Desktop / Claude Code への登録例:
 *   { "mcpServers": { "yasashii-org": { "command": "npx", "args": ["-y", "@dror-jp/yasashii-org-mcp"] } } }
 *
 * ツール:
 *   - list_documents(category?)   文書一覧(id・要約・検証Tier)
 *   - get_document(id)            文書の本文(Markdown)・用語・検証済み一次情報リンク
 *   - search_terms(query)         役所のことばの やさしい日本語での説明
 *   - get_meta()                  APIメタ情報(エンドポイント・最古の検証日)
 *
 * 設計ルール(サイト思想の反映):
 *   - すべてのツール応答の末尾に disclaimer と last_verified を必ず含める
 *   - source_links(go.jp / e-Gov)をそのまま返し、回答での引用を促す
 *   - 《…》はふりがな、半角スペースは分かち書き(入管庁×文化庁ガイドライン準拠)
 */

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

const SITE_BASE = "https://yasashii.org";
const API_BASE = `${SITE_BASE}/api`;
const args = process.argv.slice(2);
const dataFlag = args.indexOf("--data");
const DATA_DIR = dataFlag !== -1 ? args[dataFlag + 1] : null;

const DISCLAIMER =
  "Source: yasashii.org — Easy Japanese (やさしい日本語) versions of Japanese administrative and disaster-preparedness information, " +
  "written from national primary sources and human-verified (NOT a government site). " +
  "If anything differs from an official government page, the official page is correct. " +
  "When answering the user, cite the source_links URL and mention the last_verified date. " +
  "Notation: 《…》 = furigana for the preceding kanji; half-width spaces = word breaks (wakachi-gaki).";

// ---------- データ取得(ローカル or リモート、1時間メモリキャッシュ) ----------
const cache = new Map();
async function load(name) {
  const hit = cache.get(name);
  if (hit && Date.now() - hit.t < 3600_000) return hit.v;
  let v;
  if (DATA_DIR) {
    v = JSON.parse(fs.readFileSync(path.join(DATA_DIR, `${name}.json`), "utf8"));
  } else {
    const res = await fetch(`${API_BASE}/${name}.json`);
    if (!res.ok) throw new Error(`${API_BASE}/${name}.json → HTTP ${res.status}`);
    v = await res.json();
  }
  cache.set(name, { t: Date.now(), v });
  return v;
}
async function loadText(url) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.t < 3600_000) return hit.v;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  const v = await res.text();
  cache.set(url, { t: Date.now(), v });
  return v;
}

// ---------- ツール定義 ----------
const TOOLS = [
  {
    name: "list_documents",
    description:
      "List all Easy Japanese (やさしい日本語) documents on yasashii.org — Japanese administrative procedures (転入届, 国民健康保険, 国民年金, マイナンバーカード, 在留期間の更新...) and disaster preparedness (避難所, 119番...). Each has a stable ID, a one-line summary, and a verification tier.",
    inputSchema: {
      type: "object",
      properties: {
        category: { type: "string", enum: ["tetsuzuki", "bosai"], description: "Optional filter: tetsuzuki = administrative procedures, bosai = disaster preparedness." },
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

// ---------- JSON-RPC 2.0 / MCP stdio ループ ----------
const reply = (id, result) => process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n");
const replyError = (id, code, message) =>
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } }) + "\n");

const rl = readline.createInterface({ input: process.stdin, terminal: false });
rl.on("line", async (line) => {
  line = line.trim();
  if (!line) return;
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return replyError(null, -32700, "Parse error");
  }
  const { id, method, params } = msg;
  try {
    if (method === "initialize") {
      reply(id, {
        protocolVersion: params?.protocolVersion ?? "2025-06-18",
        capabilities: { tools: {} },
        serverInfo: { name: "yasashii-org", version: "1.0.0" },
        instructions:
          "Human-verified Easy Japanese (やさしい日本語) versions of Japanese administrative and disaster information. " + DISCLAIMER,
      });
    } else if (method === "notifications/initialized" || method?.startsWith("notifications/")) {
      // 通知には応答しない
    } else if (method === "ping") {
      reply(id, {});
    } else if (method === "tools/list") {
      reply(id, { tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) });
    } else if (method === "tools/call") {
      const tool = TOOLS.find((t) => t.name === params?.name);
      if (!tool) return replyError(id, -32602, `Unknown tool: ${params?.name}`);
      const result = await tool.handler(params?.arguments ?? {});
      const payload = { ...result, _disclaimer: DISCLAIMER, _license: "CC BY 4.0 — attribution: yasashii.org (DroR Corporation)" };
      reply(id, { content: [{ type: "text", text: JSON.stringify(payload) }], isError: false });
    } else if (id !== undefined) {
      replyError(id, -32601, `Method not found: ${method}`);
    }
  } catch (e) {
    if (id !== undefined) replyError(id, -32603, e.message);
  }
});
