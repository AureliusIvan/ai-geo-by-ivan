# IndexNow — fast indexing for Bing/Copilot, Yandex, Naver

IndexNow is a ping protocol. Instead of waiting for a search engine to re-crawl your site, you notify it the moment a URL is created, updated, or deleted. One POST fans out to every participating engine.

## What it does and doesn't do

**Participating engines:** Bing (powers Copilot), Yandex, Seznam, Naver.
**Not participating:** Google. They ran an experiment and never adopted it. Google Search, AI Overviews, and Gemini get **zero** benefit from IndexNow — for those, optimize core Search (sitemaps, content, schema, Search Console request-indexing).

So the entire payoff is **faster Bing/Copilot (and Yandex/Naver) indexing**. Copilot is one of the non-Google AI engines worth chasing, which is why it's in scope for AI SEO.

## Is it worth it? (honest)

It's a cheap, do-it-once setup — not a high-impact lever.

- **Worth it** on any live site that publishes or edits content and wants Copilot/Bing to notice fast. The cost is near-zero (one key file + one POST script).
- **Marginal** for tiny, mostly-static marketing sites you touch a few times a month — IndexNow shines for large, frequently-changing sites (news, ecommerce, thousands of pages).
- **Skip** sites with no domain yet or no live pages.
- It **complements**, doesn't replace, sitemap submission + Bing Webmaster Tools verification (push vs. pull).

Content structure, schema, and `llms.txt` are bigger AI-visibility wins. Treat IndexNow as a quick hygiene step once those are in place.

## How it works (two pieces)

1. **Key file** — a text file at the site root whose name is the key and whose body is the same key string. Engines fetch it to confirm you own the host.
2. **Submission** — POST a JSON body listing your changed URLs to `https://api.indexnow.org/indexnow`. The endpoint fans the submission out to all participating engines, so you only call one.

**One key works across all your domains.** Reuse the same 32-char hex key everywhere; each domain just hosts its own copy of `<key>.txt`. Generate a key once (any 8–128 hex chars, e.g. `openssl rand -hex 16`).

The key file goes live — and the first submission validates — only on the next **production deploy**. On a brand-new site, the first ping may be rejected because the key file isn't reachable yet; the next deploy's ping succeeds. To force a clean first submission, deploy once, then run the manual `indexnow` script (below).

## Reusable Next.js / Vercel implementation

This is the pattern used across the Aurelivan sites (`aitraining.id`, `aurelivan.com`, `aiforkarir.com`, `aicon.asia`, `kids.aitraining.id`). It runs automatically on every production build via the `postbuild` lifecycle script, and skips local/preview builds.

### 1. Key file → `public/<KEY>.txt`

Body is exactly the key, no trailing newline:

```bash
printf '8026434a1e2f3b4c5d6e7f8091a2b3c4' > public/8026434a1e2f3b4c5d6e7f8091a2b3c4.txt
```

Next.js serves `public/` at the domain root, so this lands at `https://<host>/<KEY>.txt`.

### 2. Ping script → `scripts/indexnow-ping.mjs`

Replace `HOST` and the `URLS` list (keep it in sync with `src/app/sitemap.ts`). Plain `.mjs`, no dependencies — uses global `fetch` (Node 18+).

```js
/**
 * Ping IndexNow after production builds so Bing (and ChatGPT Search) re-crawl
 * updated URLs quickly. Skips local/preview builds.
 *
 * Key file: public/<KEY>.txt
 * Update URLS when pages are added — keep it in sync with src/app/sitemap.ts.
 */

const HOST = "example.com";
const KEY = process.env.INDEXNOW_KEY ?? "8026434a1e2f3b4c5d6e7f8091a2b3c4";
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;
const BASE = `https://${HOST}`;

const URLS = [
  BASE,
  `${BASE}/pricing`,
  `${BASE}/about`,
  `${BASE}/llms.txt`,
  // ...mirror src/app/sitemap.ts. For data-driven routes, map over the same
  // slug/id arrays the sitemap uses, e.g.
  // ...SERVICES.map((s) => `${BASE}/services/${s}`),
];

async function main() {
  const shouldPing =
    process.env.VERCEL_ENV === "production" ||
    process.env.INDEXNOW_FORCE === "1";

  if (!shouldPing) {
    console.log(
      "[indexnow] skip (production build or INDEXNOW_FORCE=1 required)",
    );
    return;
  }

  const body = {
    host: HOST,
    key: KEY,
    keyLocation: KEY_LOCATION,
    urlList: URLS,
  };

  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });

  if (res.ok || res.status === 202) {
    console.log(`[indexnow] ok (${res.status}) — pinged ${URLS.length} URLs`);
    return;
  }

  const text = await res.text().catch(() => "");
  console.warn(`[indexnow] warn (${res.status}): ${text || res.statusText}`);
}

main().catch((err) => {
  console.warn("[indexnow] failed (non-fatal):", err.message);
  process.exit(0);
});
```

The script **fails non-fatally** (`process.exit(0)`) and only fires when `VERCEL_ENV=production` — so it never breaks a build and never pings from local or preview deploys.

### 3. Wire it into `package.json`

```jsonc
"scripts": {
  "build": "next build",
  "postbuild": "node scripts/indexnow-ping.mjs",
  "indexnow": "INDEXNOW_FORCE=1 node scripts/indexnow-ping.mjs",
  // ...
}
```

`postbuild` runs automatically after `build` on npm, pnpm, yarn, and bun — so Vercel fires it on every production build with no config. The `indexnow` script is a manual force-submit (e.g. right after a first deploy, or after editing copy without a full redeploy).

## Deploy-to-activate checklist

For each site:

1. Add `public/<KEY>.txt`, `scripts/indexnow-ping.mjs`, and the two `package.json` scripts.
2. Set `HOST` and the `URLS` list to match the site's `sitemap.ts`.
3. Deploy to production (git push → Vercel, or `vercel --prod`). The key file goes live and `postbuild` submits the URLs.
4. (Optional) Run `npm run indexnow` / `pnpm indexnow` from the folder to force an immediate submission once the key file is live.

## Verify

```bash
# Key file must be reachable (200) on the live domain:
curl -s -o /dev/null -w '%{http_code}\n' "https://<host>/<KEY>.txt"

# Local script sanity check (no env → must print the skip line):
node scripts/indexnow-ping.mjs
```

A `200` on the key file plus an `ok (200/202)` from a forced run means submissions are landing. There's no per-URL confirmation; Bing Webmaster Tools shows IndexNow submission counts under the URL Inspection / IndexNow section.

## Gotchas

- **Google ignores it.** Don't expect movement in Google/Gemini. Use Search Console request-indexing there.
- **Key file must stay live.** If it 404s, engines silently reject submissions. It ships in `public/`, so a deploy keeps it live.
- **Keep `URLS` in sync with the sitemap.** For data-driven routes (events, programs, services), map over the same arrays the sitemap uses so new entries are submitted automatically on the next build.
- **First deploy race.** `postbuild` runs during the build, before the deployment is promoted — so a brand-new key file may still 404 at first ping. The next deploy (or a manual `indexnow` run after the key is live) resolves it.
- **Don't over-submit.** IndexNow is for changed URLs. Pinging the same unchanged list every build is tolerated but pointless at high frequency; for static sites, per-deploy is fine.
