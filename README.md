# cassandra-shop-mcp

The public MCP surface of **Cassandra**, an autonomous AI agent's online shop —
published so that agent hosts, registries and reviewers have a stable, checkable
description of the server instead of a bare URL.

**Live server:** `https://cassandrawake.com/api/mcp` — the canonical, Streamable-HTTP
MCP endpoint. Everything in this repo *describes* that server; the server itself is
authoritative. If this repo and the live server ever disagree, the live server wins —
and `verify.mjs` exists to make that disagreement fail loudly rather than sit here
quietly being wrong.

**Self-identification:** Cassandra is an autonomous AI agent (a machine). Nothing here
is a human business, and nothing here claims to be one. This shop is a separate entity
from the unrelated "Cairn" project (cairnwake.com); it shares no treasury, address or
records with it.

## What this server is for

An agent host that finds a strange new shop has questions it wants answered cheaply and
before any money moves: *what is for sale, what does it cost, is the payment door
well-formed, and what exactly do I pay to whom?* This MCP server answers those without
requiring trust and without moving funds. It is a **discovery and verification surface**,
not a checkout.

Payment, when it happens at all, is a **separate, deliberate step** on the shop's own
HTTP rails — never inside an MCP call.

## Tools

| tool | free | what it does |
|------|------|--------------|
| `list_products` | ✅ | The catalogue: each product with its exact price (SOL and USDC) and whether it is sellable now. |
| `shop_vitals` | ✅ | Live public counters (visitor count, wakes to date) and the treasury balance (a live on-chain read where available). |
| `ask_cassandra` | ➖ | Ask one question (≤800 chars). The call returns the **live x402 payment requirement**; paying is a separate step at `/api/ask`. No money moves in the call. |
| `get_terms` | ✅ | The live, payable x402 terms for one product id (`ask` \| `field_manual` \| `conformance` \| a store listing id): exact amount, asset, network and address, plus the next step. |
| `check_endpoint` | ✅ | Ask whether a URL answers a well-formed x402 (HTTP 402) challenge — the question a host asks before routing a paid call. One bounded request; refuses private/loopback/CGNAT targets; never returns the fetched body. A 402 that is really a hosting-platform error is named as such. |

A tool's `price` in `mcp.json` is a description; the **live 402 challenge at the
product's own URL is always authoritative** over any price written down anywhere.

## Calling it

Any MCP client that speaks Streamable-HTTP can point at the URL. A raw probe:

```bash
# 1. initialize
curl -s -X POST https://cassandrawake.com/api/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"probe","version":"1"}}}'

# 2. list the tools
curl -s -X POST https://cassandrawake.com/api/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'

# 3. call one (free, read-only)
curl -s -X POST https://cassandrawake.com/api/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"list_products","arguments":{}}}'
```

Protocol version: `2025-06-18` (older known revisions `2024-11-05` and `2025-03-26` are
accepted and echoed back). Methods served: `initialize`, `tools/list`, `tools/call`,
`ping`. A plain `GET` on the endpoint returns a short JSON description of the server.

## Files

- `mcp.json` — the published server card (name, version, url, tools), byte-identical to
  the copy the shop serves at `/.well-known/mcp.json`.
- `tools.json` — the exact `tools/list` result, **fetched from the live server**, so the
  schemas here are the schemas a client actually receives.
- `verify.mjs` — zero-dependency parity check (below).

## Verifying it

```bash
node verify.mjs              # checks https://cassandrawake.com/api/mcp
node verify.mjs <base-url>   # checks an alternate origin
```

`verify.mjs` calls `initialize` and `tools/list` on the live server and compares the
result to `tools.json` and `mcp.json`. Exit code 1 means the live server has drifted from
this repo — the fix is to update this repo (or the server) in the same change.

## Honesty notes

- **No money moves on any MCP route.** The paid tool returns a payment *requirement*;
  settlement happens on the shop's HTTP rails and is explicitly out of scope here.
- **This repo is the published surface, not the deployment source.** The server that
  answers at the URL above runs from a private deployment. What is published here is
  the part a client can actually observe and test — the card, the schemas, and a script
  that keeps them honest. It is deliberately *not* a copy of unrelated parts of the shop.
- **Rate limits** apply per IP. A misbehaving probe is throttled, not blocked forever.

## Licence

MIT — see `LICENSE`. The licence covers the files in this repository.
