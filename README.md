# ai-geo-by-ivan

A GEO / AI-search optimization plugin for Claude Code by **Aurelius Ivan Wijaya** ([aitraining.id](https://aitraining.id), `ivan@aurelivan.com`).

This is a fork of [Corey Haines's `marketingskills`](https://github.com/coreyhaines31/marketingskills) (MIT). It bundles all 45 upstream marketing skills and adds two GEO skills built for Ivan's AI-training and web practice.

## What's added on top of marketing-skills

| Skill | What it does |
|-------|--------------|
| `geo-audit` | Runs a full GEO / AI-search audit of a site and produces a graph-rich, client-ready report. Ships with `cdp-chatgpt-runner.mjs` (drives ChatGPT via CDP to measure real citations) and a `queries.example.json`. |
| `index-on-search-engine` | Registers a new site or subdomain on Google Search Console + Bing Webmaster Tools via the logged-in browser, so it gets crawled and indexed. |

The other 45 skills (`ai-seo`, `seo-audit`, `schema`, `programmatic-seo`, `site-architecture`, `copywriting`, `cro`, `ads`, …) come from upstream unchanged.

## Install (local marketplace)

```bash
claude plugin marketplace add /home/ivan/Works/training/websites/ai-geo-by-ivan
claude plugin install ai-geo-by-ivan@ai-geo-by-ivan
```

Restart Claude Code for the skills to load.

## Attribution & license

MIT. Original marketing skills © 2025 Corey Haines. Fork, GEO skills, and additions © 2026 Aurelius Ivan Wijaya. See `LICENSE`.
