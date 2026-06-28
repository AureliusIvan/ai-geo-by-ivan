// GEO audit — live ChatGPT query runner over Chrome DevTools Protocol.
//
// Prereqs (see SKILL.md Step 2):
//   1. A sidecar Chrome profile copy is running with --remote-debugging-port=9222
//      and is logged into ChatGPT (Chrome blocks CDP on the DEFAULT profile).
//   2. Node 22+ (global WebSocket). No MCP needed.
//
// Usage:  node cdp-chatgpt-runner.mjs [queriesFile] [outFile]
//   queriesFile : JSON array of { id, lang, q }  (default ./queries.json)
//   outFile     : results JSON                    (default ./geo-results.json)
//
// Behavior: one fresh NORMAL chat per query (temporary chat returns empty under
// automation), waits for streaming to finish (stop-button gone), extracts the
// answer + external links, flags brand mentions, then DELETES the conversation.
// Queries auto-routed to the reasoning model render empty -> marked ok:false; treat
// those as N/A in the report, never fabricate.

const BASE = process.env.CDP_URL || 'http://127.0.0.1:9222';
const QFILE = process.argv[2] || './queries.json';
const OUT   = process.argv[3] || './geo-results.json';
const BRAND = process.env.BRAND || 'ngepost'; // regex for the brand mention flag

const fs = await import('node:fs');
const QS = JSON.parse(fs.readFileSync(QFILE, 'utf8'));
const results = [];
const save = () => fs.writeFileSync(OUT, JSON.stringify(results, null, 2));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const j = s => { try { return JSON.parse(s) } catch { return null } };

const targets = await (await fetch(BASE + '/json')).json();
const page = targets.find(t => t.type === 'page' && t.url.includes('chatgpt.com'))
          || targets.find(t => t.type === 'page');
if (!page) { console.error('No ChatGPT page target. Is the sidecar Chrome up on :9222?'); process.exit(1); }

const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0; const pend = {};
const cmd = (m, p = {}) => { const i = ++id; ws.send(JSON.stringify({ id: i, method: m, params: p })); return new Promise(r => pend[i] = r); };
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend[m.id]) pend[m.id](m.result); };
await new Promise(r => ws.onopen = r);
await cmd('Page.enable'); await cmd('Runtime.enable');
const ev = async x => (await cmd('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.value;

const EXTRACT = `(()=>{const a=[...document.querySelectorAll('[data-message-author-role="assistant"]')].pop();
  if(!a) return JSON.stringify({answer:'',links:[]});
  const mds=[...a.querySelectorAll('.markdown')]; let txt=mds.map(m=>m.innerText).join('\\n').trim();
  if(!txt) txt=(a.innerText||'').replace(/Thought for[^\\n]*/g,'').trim();
  const links=[...a.querySelectorAll('a[href]')].map(x=>x.href).filter(h=>/^https?:/.test(h)&&!/chatgpt\\.com|openai\\.com/.test(h));
  return JSON.stringify({answer:txt,links:[...new Set(links)]});})()`;

const brandRe = new RegExp(BRAND, 'i');

for (const item of QS) {
  const rec = { id: item.id, lang: item.lang, query: item.q, answer: '', links: [], brand: false, convId: null, deleted: false, ok: false };
  try {
    await cmd('Page.navigate', { url: 'https://chatgpt.com/' });
    for (let k = 0; k < 25; k++) { await sleep(700); if (await ev(`!!document.querySelector('#prompt-textarea')`)) break; }
    await sleep(1500);
    await ev(`document.querySelector('#prompt-textarea')?.focus()`);
    await sleep(300);
    await cmd('Input.insertText', { text: item.q });
    await sleep(800);
    await ev(`document.querySelector('[data-testid="send-button"]')?.click()`);
    // completion: stop-button seen then gone, text stable
    let last = '', stable = 0, sawStop = false;
    for (let k = 0; k < 80; k++) {           // up to ~160s
      await sleep(2000);
      const s = j(await ev(`JSON.stringify({stop:!!document.querySelector('[data-testid="stop-button"],[aria-label="Stop streaming"]'),txt:(()=>{const a=[...document.querySelectorAll('[data-message-author-role=\\"assistant\\"]')].pop();return a?a.innerText:''})()})`)) || { stop: false, txt: '' };
      if (s.stop) sawStop = true;
      if (s.txt === last && s.txt.length > 0) stable++; else stable = 0;
      last = s.txt;
      if (sawStop && !s.stop && stable >= 2 && last.length > 0) break;
      if (!sawStop && stable >= 8 && last.length > 0) break;
    }
    const out = j(await ev(EXTRACT)) || { answer: '', links: [] };
    rec.answer = out.answer; rec.links = out.links;
    rec.brand = brandRe.test(out.answer);
    rec.ok = out.answer.length > 0;
    rec.convId = await ev(`(location.href.match(/\\/c\\/([0-9a-f-]+)/)||[])[1]||null`);
    if (rec.convId) {
      rec.deleted = !!(await ev(`(async()=>{try{const s=await(await fetch('/api/auth/session')).json();
        const r=await fetch('/backend-api/conversation/${rec.convId}',{method:'PATCH',headers:{'Authorization':'Bearer '+s.accessToken,'Content-Type':'application/json'},body:JSON.stringify({is_visible:false})});return r.ok}catch(e){return false}})()`));
    }
  } catch (e) { rec.error = String(e); }
  results.push(rec); save();
  console.log(`[${item.id}/${QS.length}] ${item.lang} ok=${rec.ok} brand=${rec.brand} del=${rec.deleted} len=${rec.answer.length} :: ${item.q.slice(0, 50)}`);
  await sleep(3500);
}
ws.close();
console.log('DONE -> ' + OUT);
