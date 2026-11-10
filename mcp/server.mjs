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
import { createServer } from "./core.mjs";

const SITE_BASE = "https://yasashii.org";
const API_BASE = `${SITE_BASE}/api`;
const args = process.argv.slice(2);
const dataFlag = args.indexOf("--data");
const DATA_DIR = dataFlag !== -1 ? args[dataFlag + 1] : null;

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

// ---------- JSON-RPC 2.0 / MCP stdio ループ(ツール定義と応答は core.mjs と共通) ----------
const server = createServer({ load, loadText });
const send = (obj) => process.stdout.write(JSON.stringify(obj) + "\n");

const rl = readline.createInterface({ input: process.stdin, terminal: false });
rl.on("line", async (line) => {
  line = line.trim();
  if (!line) return;
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
  }
  const res = await server.handle(msg);
  if (res) send(res);
});
