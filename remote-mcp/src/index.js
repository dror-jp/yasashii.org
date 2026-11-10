// yasashii.org remote MCP server — Streamable HTTP transport, stateless, read-only.
// Endpoint: https://mcp.yasashii.org/mcp
// Tool definitions and JSON-RPC handling are shared with the npm stdio server (../../mcp/core.mjs).

import { createServer, SUPPORTED_PROTOCOL_VERSIONS, VERSION } from "../../mcp/core.mjs";

const SITE_BASE = "https://yasashii.org";
const API_BASE = `${SITE_BASE}/api`;
const CACHE_MS = 3600_000;
const MAX_BODY = 64 * 1024;

// Origin: every origin is accepted on purpose. The data is public, read-only and needs no
// credentials (no Allow-Credentials), and the DNS-rebinding guard in the spec targets local servers.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID",
  "Access-Control-Expose-Headers": "Mcp-Session-Id",
  "Access-Control-Max-Age": "86400",
};

// Per-isolate cache of the site's API files.
const cache = new Map();

async function fetchSite(env, url, label) {
  let res;
  if (env.SITE) {
    try {
      res = await env.SITE.fetch(new Request(url));
    } catch {
      res = undefined;
    }
    if (res && !res.ok) {
      await res.body?.cancel();
      res = undefined;
    }
  }
  console.log(JSON.stringify({ load: label, via: res ? "binding" : "public" }));
  if (!res) res = await fetch(url, { cf: { cacheTtl: 3600 } });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res;
}

function makeLoaders(env) {
  const cached = async (key, get) => {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.t < CACHE_MS) return hit.v;
    const v = await get();
    cache.set(key, { t: Date.now(), v });
    return v;
  };
  return {
    load: (name) => cached(name, async () => (await fetchSite(env, `${API_BASE}/${name}.json`, name)).json()),
    loadText: (url) => {
      // Only the site's own Markdown mirrors are fetched.
      if (typeof url !== "string" || !url.startsWith(SITE_BASE + "/")) {
        return Promise.reject(new Error(`Refusing to fetch ${url}`));
      }
      return cached(url, async () => (await fetchSite(env, url, "markdown")).text());
    },
  };
}

const json = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...CORS, ...extra } });

const rpcError = (status, code, message) => json({ jsonrpc: "2.0", id: null, error: { code, message } }, status);

const INFO_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>yasashii.org MCP server</title><meta name="robots" content="noindex">
<style>body{font:16px/1.7 system-ui,sans-serif;max-width:42rem;margin:2rem auto;padding:0 1rem;color:#222;background:#fff}code{background:#f2f2f2;padding:.1em .3em;border-radius:3px}</style></head><body>
<h1>yasashii.org MCP server</h1>
<p>Remote <a href="https://modelcontextprotocol.io/">Model Context Protocol</a> server: human-verified Easy Japanese (<span lang="ja">やさしい日本語</span>) versions of Japanese administrative procedures and disaster-preparedness information.</p>
<p><strong>This is not a government website.</strong> If anything differs from an official page, the official page is correct.</p>
<p>Endpoint (Streamable HTTP, no authentication): <code>https://mcp.yasashii.org/mcp</code></p>
<p>Tools: <code>list_documents</code>, <code>get_document</code>, <code>search_terms</code>, <code>get_meta</code>.</p>
<p>Local alternative: <code>npx -y @dror-jp/yasashii-org-mcp</code>. Text: CC BY 4.0, attribution <em>yasashii.org (DroR Corporation)</em>.</p>
<p><a href="https://yasashii.org/data/">About the data</a> · <a href="https://github.com/dror-jp/yasashii.org">Source</a> · Run by <a href="https://dror.co.jp">DroR Corporation</a></p>
</body></html>`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

    if (url.pathname === "/" && (request.method === "GET" || request.method === "HEAD")) {
      return new Response(request.method === "HEAD" ? null : INFO_HTML, {
        headers: { "Content-Type": "text/html; charset=utf-8", ...CORS },
      });
    }

    if (url.pathname !== "/mcp") return json({ error: "Not found. MCP endpoint: /mcp" }, 404);

    // Stateless server: no server-initiated SSE stream and no sessions to delete.
    if (request.method !== "POST") return json({ error: "Method not allowed. Use POST." }, 405, { Allow: "POST, OPTIONS" });

    if (env.LIMITER) {
      const key = request.headers.get("CF-Connecting-IP") ?? "unknown";
      const { success } = await env.LIMITER.limit({ key });
      if (!success) return rpcError(429, -32000, "Rate limit exceeded. Try again in a minute.");
    }

    const pv = request.headers.get("Mcp-Protocol-Version");
    if (pv && !SUPPORTED_PROTOCOL_VERSIONS.includes(pv)) {
      return rpcError(400, -32600, `Unsupported MCP-Protocol-Version: ${pv}`);
    }

    const declared = Number(request.headers.get("Content-Length") ?? 0);
    if (declared > MAX_BODY) return rpcError(413, -32600, "Request too large");
    const text = await request.text();
    if (text.length > MAX_BODY) return rpcError(413, -32600, "Request too large");
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      return rpcError(400, -32700, "Parse error");
    }

    const server = createServer(makeLoaders(env));
    const messages = Array.isArray(body) ? body : [body];
    if (messages.length === 0 || messages.length > 20) return rpcError(400, -32600, "Invalid Request");

    const results = (await Promise.all(messages.map((m) => server.handle(m)))).filter(Boolean);
    // Only notifications/responses were sent → 202 Accepted with no body.
    if (results.length === 0) return new Response(null, { status: 202, headers: CORS });
    return json(Array.isArray(body) ? results : results[0], 200, { "X-MCP-Server-Version": VERSION });
  },
};
