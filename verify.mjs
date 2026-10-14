#!/usr/bin/env node
// verify.mjs — parity check for the Cassandra shop's MCP surface.
//
// This repo is a description of a REMOTE MCP server, not the server's
// implementation. The risk with a description is silent drift: the live server
// changes and the repo keeps asserting the old shape. This script makes that
// drift fail loudly, so the repo cannot quietly become a false claim.
//
// It fetches the LIVE server and compares it, field by field, to the copies
// committed here:
//   - tools.json  : the exact tools/list result (names + inputSchema)
//   - mcp.json    : the published server card (url, version, tool names)
//
// Exit 0 = live server matches this repo. Exit 1 = drift; fix the repo (or the
// server) in the same change.
//
// Usage:  node verify.mjs            (checks the public origin)
//         node verify.mjs <url>      (checks an alternate base URL)
//
// Zero dependencies. Node 18+ (global fetch).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const BASE = (process.argv[2] || 'https://cassandrawake.com').replace(/\/$/, '');
const MCP_URL = `${BASE}/api/mcp`;

const fails = [];
const ok = (msg) => console.log(`  ok   ${msg}`);
const bad = (msg) => { fails.push(msg); console.log(`  FAIL ${msg}`); };

async function rpc(method, params) {
  const res = await fetch(MCP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`${method} -> HTTP ${res.status}`);
  const body = await res.json();
  if (body.error) throw new Error(`${method} -> JSON-RPC error ${JSON.stringify(body.error)}`);
  return body.result;
}

const card = JSON.parse(readFileSync(join(here, 'mcp.json'), 'utf8'));
const tools = JSON.parse(readFileSync(join(here, 'tools.json'), 'utf8'));

console.log(`verifying ${MCP_URL} against this repo's committed shape\n`);

// 1. initialize — the server identifies itself and offers the tools capability.
const init = await rpc('initialize', {
  protocolVersion: card.protocolVersion,
  capabilities: {},
  clientInfo: { name: 'cassandra-shop-mcp-verify', version: '1' },
});
if (init.serverInfo && init.serverInfo.name === card.name) ok(`initialize: serverInfo.name = ${card.name}`);
else bad(`initialize: serverInfo.name = ${JSON.stringify(init.serverInfo)} (card says ${card.name})`);
if (init.protocolVersion === card.protocolVersion) ok(`initialize: protocolVersion = ${card.protocolVersion}`);
else bad(`initialize: protocolVersion = ${init.protocolVersion} (card says ${card.protocolVersion})`);

// 2. tools/list — names and input schemas must match tools.json exactly.
const live = await rpc('tools/list', {});
const liveTools = live.tools || [];
const liveByName = new Map(liveTools.map((t) => [t.name, t]));
const wantNames = tools.tools.map((t) => t.name);

for (const want of tools.tools) {
  const got = liveByName.get(want.name);
  if (!got) { bad(`tools/list: tool '${want.name}' is gone from the live server`); continue; }
  const a = JSON.stringify(got.inputSchema);
  const b = JSON.stringify(want.inputSchema);
  if (a === b) ok(`tools/list: ${want.name} (schema matches)`);
  else bad(`tools/list: ${want.name} inputSchema drifted\n        repo: ${b}\n        live: ${a}`);
}
for (const got of liveTools) {
  if (!wantNames.includes(got.name)) bad(`tools/list: live server added unknown tool '${got.name}' (update tools.json)`);
}

// 3. the card must name the same tools, and the same url.
if (card.url === MCP_URL) ok(`card: url = ${card.url}`);
else bad(`card: url = ${card.url} (checked ${MCP_URL})`);
const cardNames = (card.tools || []).map((t) => t.name).sort();
const wantSorted = [...wantNames].sort();
if (JSON.stringify(cardNames) === JSON.stringify(wantSorted)) ok(`card: names the same ${cardNames.length} tools`);
else bad(`card names [${cardNames}] but live server serves [${wantSorted}]`);

console.log('');
if (fails.length) {
  console.log(`${fails.length} drift(s) — this repo no longer matches the live server.`);
  process.exit(1);
}
console.log('live server matches this repo exactly.');
