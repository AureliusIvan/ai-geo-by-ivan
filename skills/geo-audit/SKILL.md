---
name: geo-audit
description: >-
  Run a full GEO / AI-search audit of a website and produce a graph-rich,
  client-ready report. Use whenever the user asks to "audit GEO", "GEO audit",
  "AI SEO audit", "check if X shows up in ChatGPT / Perplexity / AI Overviews",
  "test our site against ChatGPT queries", "are we cited by AI", "AI visibility
  audit", "generative engine optimization audit", or points at a client website
  and wants to know how it performs in AI-generated answers. Covers the three
  pillars (Presence, Authority/Content, Structure), the multi-subagent recon
  pattern, the LIVE ChatGPT-testing method over Chrome DevTools Protocol (with
  all the gotchas), and the reusable HTML report template that renders from one
  data object. Pairs with the marketing-skills:ai-seo skill (strategy) — this
  skill is the execution + reporting playbook for THIS portfolio.
---

# GEO Audit (Generative Engine Optimization)

Goal: tell a client whether AI answer engines (ChatGPT, Perplexity, AI Overviews,
Claude, Copilot) **surface and cite** their site, why/why not, and the prioritized
plan to fix it — delivered as a polished PDF/HTML report.

First read `marketing-skills:ai-seo` for the strategy/theory. This skill is the
**execution playbook + reporting harness** for Ivan's portfolio.

## Mental model: two halves, in this order

GEO success = (1) **be retrievable + corroborated** (off-site presence + on-site
content depth) and (2) **be extractable** (schema/structure). For early-stage sites
the binding constraint is almost always #1. **Do not lead with schema fixes** on a
site that has nothing to retrieve and zero third-party footprint — it won't move
citations. Score and sequence accordingly.

Three pillars (each 0–100, used for the report's bars + radar):
1. **Presence** — Wikipedia/Wikidata, Product Hunt, G2/Capterra, Reddit, YouTube,
   listicles, local tech media, third-party comparison pages, referencing domains.
2. **Authority & content** — blog/guides, FAQ, comparison pages, case studies,
   sourced stats, author bylines, dates.
3. **Structure** — JSON-LD schema, robots.txt/sitemap/llms.txt, OpenGraph,
   server-side rendering, public pricing, a one-sentence product definition.

## Workflow

### Step 0 — Scope
Confirm the URL, what the product is, and its real market/language (e.g. ngepost =
Indonesian SMM tool, so test in EN **and** Bahasa). Identify the closest real
competitor (it anchors the comparison pages and the brand queries).

### Step 1 — Fan out 3 parallel subagents (general-purpose, web tools)
Launch together in one message:
- **Technical crawl**: fetch `/`, `/robots.txt`, `/llms.txt`, `/sitemap.xml`,
  `/pricing`, plus discovered pages. Check JSON-LD (`application/ld+json`),
  OG/Twitter tags, SSR vs JS-gated, public pricing, FAQ, comparison pages,
  AI-bot access. Output the extractability checklist (pass/partial/fail + evidence).
- **Query/citation research**: build ~15–20 queries across intents (category,
  best-of, use-case, comparison, brand, BI-local). Each: does the brand appear,
  who appears instead, source types. (This is the *reconstruction* layer — see
  Step 2 for the real live test.)
- **Off-site presence**: the 11 channels above; presence scorecard + verdict.

### Step 2 — LIVE ChatGPT test (the real thing) — see `assets/cdp-chatgpt-runner.mjs`
This is what makes the audit genuine rather than a reconstruction. It drives the
user's **logged-in ChatGPT** over Chrome DevTools Protocol. The gotchas below are
hard-won — follow them exactly.

1. **Chrome blocks CDP on the DEFAULT profile** (`"DevTools remote debugging
   requires a non-default data directory"`, Chrome 136+). You cannot attach to the
   real profile. **Workaround:** copy the auth-relevant files to a sidecar profile:
   ```bash
   SRC="$HOME/.config/google-chrome"; DST="$HOME/.config/google-chrome-cdp"
   rm -rf "$DST"; mkdir -p "$DST/Default"
   cp -a "$SRC/Local State" "$DST/"              # holds the cookie-decryption key
   for f in Cookies Cookies-journal Network Preferences "Secure Preferences" \
            "Web Data" "Login Data" "Local Storage" "Session Storage"; do
     cp -a "$SRC/Default/$f" "$DST/Default/" 2>/dev/null; done
   ```
   ~200 MB, and the ChatGPT login carries over via cookies.
2. **Launch the sidecar with the debug port** (headed, so login is visible/fixable):
   ```bash
   google-chrome --user-data-dir="$HOME/.config/google-chrome-cdp" \
     --remote-debugging-port=9222 --remote-debugging-address=127.0.0.1 \
     --no-first-run --no-default-browser-check "https://chatgpt.com/" &
   ```
   Verify: `curl -s http://127.0.0.1:9222/json/version`. Confirm login carried over
   (composer present, no "Log in"). You do NOT need to register any MCP — drive it
   directly with node (Node 22+ has global `WebSocket`).
3. **Use NORMAL chats, not temporary chat.** Temporary chat defaults to a reasoning
   model that returns **empty** under automation. Instead use normal chats and
   **delete each conversation after** via the backend API (the runner does this) to
   preserve the same privacy.
4. **Submit** by `Input.insertText` into `#prompt-textarea` then clicking
   `[data-testid="send-button"]` (more reliable than Enter).
5. **Completion = the stop button disappears**: poll `[data-testid="stop-button"]`;
   done when it was seen and is now gone AND the answer text is stable. Do NOT rely
   on the `.result-thinking` class.
6. **Reasoning-model queries won't capture.** Some queries (often "best in <country>
   2026" and brand-review/alternatives) get auto-routed to `gpt-5-5-thinking`, which
   renders only "Thought for Xs" under automation. Retry once; if still empty, mark
   the row **N/A / inconclusive** — never fabricate an answer.
7. **Extract** the last `[data-message-author-role="assistant"]` innerText (fallback:
   its `.markdown` block, then the last conversation-turn). Flag brand mentions and
   collect external links (citations).
8. **Cleanup** when done: kill only the sidecar (`pkill -f -- "--user-data-dir=
   $HOME/.config/google-chrome-cdp"`), `rm -rf` the sidecar profile. The user's main
   Chrome is never touched.

Run it: `node assets/cdp-chatgpt-runner.mjs` (reads `queries.json`, writes
`geo-results.json`). Run long jobs in the background and watch with Monitor.

**Key live-finding to look for:** not just absence, but **brand confusion** — ChatGPT
substituting similarly-named products (e.g. ngepost → Nexapost/NexoPost/OmniPost).
That's an entity-disambiguation problem and belongs in the report.

### Step 3 — Build the report
Canonical template: `~/Works/training/websites/geo-audit-templates/geo-audit-template.html`
(self-contained, Chart.js via CDN, renders entirely from one `AUDIT_DATA` object).
Copy it to `geo-audit-<client>.html`, edit only `AUDIT_DATA`:
- `meta`, `overallScore`/`scoreLabel`/`scoreColor`, `verdict`, `stats`
- `pillars` (3 bars), `radar` (8 axes), `visibility` (donut + share-of-voice bar +
  query table; `cited: true|false|null` where null = N/A), `channels`,
  `technical` (pass/partial/fail), `roadmap` (3 phases), `caveats`.
Export PDF headless:
```bash
google-chrome-stable --headless=new --disable-gpu --no-sandbox \
  --no-pdf-header-footer --print-to-pdf="<Client>-GEO-Audit.pdf" \
  --virtual-time-budget=8000 "file://$PWD/geo-audit-<client>.html"
```
Then Read the PDF pages to verify charts actually drew before delivering.

### Step 4 — Slop + deliver (house rule #1, non-negotiable)
Run the `anti-ai-slop-police` agent on the report's client-facing prose (the
`AUDIT_DATA` strings + section descriptions). Apply fixes (no em-dashes — use colons;
no "X not Y" foils; ground every claim) and re-audit until **ALLOW**. Then offer to
save to the training Drive subfolder per house rule #5.

## Report roadmap shape (default)
P0 Presence (Product Hunt + directories + G2/Capterra + local PR/listicles) →
P1 Content (comparison pages "X vs <competitor>", blog/guides on winnable intent,
FAQ + homepage definition) → P2 Technical (JSON-LD, robots/sitemap/llms.txt, OG,
dated proof). Highest-leverage single move = Product Hunt + one local listicle + one
"X vs <closest competitor>" page shipped together. Add an entity-disambiguation
section if the live test showed brand confusion.

## Gotchas (don't relearn these)
- Foreground `sleep` is blocked; use `run_in_background` + Monitor with an until-loop.
- Print width can trip mobile breakpoints → force grid columns in `@media print`.
- A 0-cited donut renders blank; the template draws a center "0%" label — keep it.
- Word-collision: "ngepost" = Bahasa slang for "posting"; generic hits are noise,
  not brand mentions. Verify before counting.
