// node scripts/build-site.mjs — build the static site into _site/ (no dependencies).
// One page per subject folder that has a <subject>/report.json (written by `npm run report`), plus a home page.
// Per subject, optional: site.json (recap, batch and document names), lean.json (claim lean tags),
// videos.txt / blogs.txt (batch sections are "# --- <Label>, ..." headers).
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const OUT = join(ROOT, '_site');
const readJson = (p, fallback) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : fallback);
const readText = p => (existsSync(p) ? readFileSync(p, 'utf8') : '');
const he = s => String(s).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
const esc = s => s.replace(/</g, '\\u003c');

// Same rule as watcher's strongest(): latest per (method, document), then judgment > confidence (an AI guess counts
// at most 0.5) > method > date. Mirrored here so the page can show which verdict decides without the library.
const RANK = { prior: 0, source: 1, empirical: 2 };
const W = x => (x.method === 'prior' ? Math.min(x.confidence ?? 0, 0.5) : (x.confidence ?? 0));
const J = x => (['right', 'wrong', 'partly'].includes(x.verdict) ? 1 : 0);
const best = xs => [...xs].sort((a, b) => J(b) - J(a) || W(b) - W(a) || RANK[b.method] - RANK[a.method] || (b.date > a.date ? 1 : b.date < a.date ? -1 : 0))[0];
const latestPerDoc = vs => { const m = new Map(); for (const x of vs) { const k = x.method + '|' + (x.source?.split('#')[0] ?? ''); if (!m.has(k) || x.date >= m.get(k).date) m.set(k, x); } return [...m.values()]; };

const ICON = {
  video: '<svg class="ic" viewBox="0 0 16 16" role="img" aria-label="Video"><rect x="1" y="3" width="14" height="10" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M6.5 5.8v4.4L10.3 8z" fill="currentColor"/></svg>',
  post: '<svg class="ic" viewBox="0 0 16 16" role="img" aria-label="Blog post"><path d="M3.5 1.5h6l3 3v10h-9z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M5.5 7.5h5M5.5 10h5M5.5 12.5h3" stroke="currentColor" stroke-width="1.2"/></svg>',
};

const CSS = `
:root{--bg:#f7f8f9;--surface:#ffffff;--fg:#1d2328;--muted:#5d6872;--line:#dde2e6;--accent:#1f6f78;
  --right:#2e7d4f;--partly:#a66a00;--wrong:#b3261e;--other:#6b7280;
  --display:"Source Serif 4",Georgia,serif;--body:"IBM Plex Sans",system-ui,sans-serif;--mono:"IBM Plex Mono",ui-monospace,monospace}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#12161a;--surface:#1a2026;--fg:#e4e8eb;--muted:#9aa5ae;--line:#2c343b;--accent:#5fb3bb;
  --right:#5cc285;--partly:#e0a640;--wrong:#ef6b62;--other:#9aa3ad;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#12161a;--surface:#1a2026;--fg:#e4e8eb;--muted:#9aa5ae;--line:#2c343b;--accent:#5fb3bb;
  --right:#5cc285;--partly:#e0a640;--wrong:#ef6b62;--other:#9aa3ad;color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.55 var(--body)}
main{max-width:860px;margin:0 auto;padding-block:32px 64px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));display:grid;gap:40px}
nav.crumbs{font:13px var(--mono);color:var(--muted)}nav.crumbs a{color:var(--muted)}
h1,h2{font-family:var(--display);text-wrap:balance;margin:0}
h1{font-size:2.1rem;line-height:1.15}h2{font-size:1.35rem;margin-bottom:12px}
h3{font:600 1rem var(--body);margin:16px 0 8px}
.lede{color:var(--muted);max-width:65ch;margin:8px 0 0}
.meta{font:12px var(--mono);color:var(--muted);letter-spacing:.04em;text-transform:uppercase}
ol,ul{margin:0;padding-left:1.2em;display:grid;gap:10px}
li{max-width:70ch}
.v{display:inline-block;font:11px/1 var(--mono);text-transform:uppercase;letter-spacing:.06em;padding:4px 6px;border-radius:3px;border:1px solid currentColor;white-space:nowrap}
.v-right{color:var(--right)}.v-partly{color:var(--partly)}.v-wrong{color:var(--wrong)}.v-untestable,.v-unknown{color:var(--other)}
.filters{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px}
.filters button,.filters input{font:13px var(--body);padding:6px 10px;border:1px solid var(--line);background:var(--surface);color:var(--fg);border-radius:4px;cursor:pointer}
.filters input{cursor:text;flex:1 1 200px;min-width:0}
.filters button[aria-pressed="true"]{border-color:var(--accent);color:var(--accent);font-weight:600}
a:focus-visible,button:focus-visible,input:focus-visible,summary:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.claim{border-top:1px solid var(--line);padding:12px 0;display:grid;gap:4px}
.claim .row{display:flex;gap:10px;align-items:baseline;justify-content:space-between}
.claim p{margin:0}.claim .note{color:var(--muted);font-size:14px}
.claim .stat{font:12px var(--mono);color:var(--muted);font-variant-numeric:tabular-nums}
.table{overflow-x:auto}
table{width:100%;border-collapse:collapse;font-size:14px}
th,td{text-align:left;padding:8px 6px;border-top:1px solid var(--line);vertical-align:top}
th{font:12px var(--mono);text-transform:uppercase;letter-spacing:.04em;color:var(--muted);border-top:none}
td.num{font-variant-numeric:tabular-nums;font-family:var(--mono);white-space:nowrap}
.sc{font-weight:600}.sc-2{color:var(--right)}.sc-1{color:var(--accent)}.sc-0{color:var(--muted)}.sc--1{color:var(--wrong)}
a{color:var(--accent)}
.small{font-size:13px;color:var(--muted)}
.ic{width:1em;height:1em;vertical-align:-0.15em;margin-right:6px;color:var(--muted)}
.lean{display:flex;height:10px;border-radius:3px;overflow:hidden;background:var(--line);margin:4px 0 2px;max-width:420px}
.lean span{display:block;height:100%}
.l-pro{background:var(--right)}.l-neu{background:var(--other);opacity:.45}.l-cal{background:var(--partly)}.l-sk{background:var(--wrong)}
tr.sup td{opacity:.55}
@media (max-width:560px){.vtbl th:nth-child(4),.vtbl td:nth-child(4){display:none}h1{font-size:1.7rem}}
.cards{display:grid;gap:16px;grid-template-columns:repeat(auto-fill,minmax(260px,1fr))}
.card{display:grid;gap:8px;padding:18px;background:var(--surface);border:1px solid var(--line);border-radius:8px;text-decoration:none;color:inherit}
.card:hover{border-color:var(--accent)}
.card h2{font-size:1.2rem;margin:0;color:var(--accent)}
.card .stats{font:12px var(--mono);color:var(--muted)}
`;

const page = ({ title, body, script = '' }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${he(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,500;8..60,700&family=IBM+Plex+Sans:wght@400;600&family=IBM+Plex+Mono:wght@400&display=swap">
<style>${CSS}</style>
</head>
<body>
<main>
${body}
</main>
${script}
</body>
</html>
`;

// Sections of a list file: "# --- <Label>, rest" starts one; text before the first header is section 0.
function listSections(text, firstLabel) {
  const parts = text.split(/^# --- /m);
  return parts.map((s, i) => ({
    label: i === 0 ? firstLabel : s.split('\n')[0].split(/[,.:(]/)[0].trim(),
    urls: new Set(s.match(/https?:\/\/[^\s#]+(#\S*)?/g) ?? []),
    vids: new Set((s.match(/v=([\w-]{11})/g) ?? []).map(x => x.slice(2))),
  })).filter(s => s.urls.size);
}

function buildSubject(dir, name) {
  const r = readJson(join(dir, 'report.json'));
  const t = r.topics[0];
  if (!t || !t.claims.length) return null;
  const cfg = readJson(join(dir, 'site.json'), {});
  const lean = readJson(join(dir, 'lean.json'), null);
  const recs = readdirSync(join(dir, 'store', 'videos')).map(f => JSON.parse(readFileSync(join(dir, 'store', 'videos', f), 'utf8')));
  const recOf = Object.fromEntries(recs.map(v => [v.id, v]));
  const srcPrefix = name + '/sources/';
  const DOC = cfg.docs ?? {};
  const docName = src => { const f = (src ?? '').split('#')[0].split('/').pop(); return DOC[f] ?? f; };

  const byClaim = {};
  for (const v of recs) for (const a of v.assertions ?? []) (byClaim[a.claim] ??= []).push(...a.verdicts);
  const claims = t.claims.map(c => {
    const all = latestPerDoc(byClaim[c.id] ?? []);
    const s = best(all), e = best(all.filter(x => x.method !== 'prior'));
    const srcs = [...new Set(all.filter(x => x.source).map(x => x.source.split('#')[0].split('/').pop()))];
    return { id: c.id, text: c.text, a: c.asserted, n: c.denied, v: c.effective,
      conf: s && J(s) ? W(s) : null, note: s?.note ?? '', src: s?.source ? docName(s.source) : null, srcs,
      ev: e && { conf: e.confidence ?? null, note: e.note ?? '', src: docName(e.source) }, pr: best(all.filter(x => x.method === 'prior')) };
  });
  const cOf = Object.fromEntries(claims.map(c => [c.id, c]));

  const videos = r.videos.filter(v => v.assertions).map(v => {
    const x = recOf[v.id], art = x.transcript === 'article' || (!!x.url && !/^[\w-]{11}$/.test(v.id));
    return { id: v.id, title: v.title, ch: v.channel, s: v.scaled, w: v.worthWatching, nov: v.novelty, art,
      href: art ? x.url : 'https://www.youtube.com/watch?v=' + v.id, sum: x.summary ?? '' };
  });
  const used = recs.filter(v => v.assertions?.length && !v.supersededBy);
  const usedIds = new Set(used.map(v => v.id));
  const nArt = videos.filter(v => v.art && usedIds.has(v.id)).length, nVid = used.length - nArt;
  const link = v => (v.art ? ICON.post : ICON.video) + '<a href="' + he(v.href) + '">' + he(v.title) + '</a>';
  const ranked = videos.filter(v => v.s != null).sort((a, b) => b.s - a.s || b.nov - a.nov);
  const top5 = ranked.slice(0, 5).map(v => '<li>' + link(v) + ' <span class="small">(' + he(v.ch) + ' · novelty ' + v.nov.toFixed(2) + ')</span>. ' + he(v.sum) + '</li>').join('\n');
  const runners = ranked.slice(5, 10).map(v => link(v) + ' (' + v.nov.toFixed(2) + ')').join(', ');

  // What the studies changed.
  const VAL = { right: 1, partly: 0.5, wrong: -1 };
  const pct = x => (x == null ? '' : ' ' + Math.round(x * 100) + '%');
  const surp = (t.surprises ?? []).map(s => ({ ...s, c: cOf[s.claim.id], move: Math.abs(VAL[s.evidence] - VAL[s.prior]) }))
    .sort((a, b) => b.move - a.move || (b.claim.asserted + b.claim.denied) - (a.claim.asserted + a.claim.denied));
  const surpLi = s => '<li><strong>' + he(s.claim.text) + '</strong> <span class="small">(said by ' + (s.claim.asserted + s.claim.denied) + ')</span><br>'
    + 'AI guess: <span class="v v-' + s.prior + '">' + s.prior + pct(s.c.pr?.confidence) + '</span> · Study: <span class="v v-' + s.evidence + '">' + s.evidence + pct(s.c.ev?.conf) + '</span><br>'
    + '<span class="small">' + he(s.c.ev?.note ?? '') + ' (' + he(s.c.ev?.src ?? '') + ')</span></li>';
  const changed = surp.filter(s => s.overrides), held = surp.filter(s => !s.overrides);

  // Recap: configured headline claims (or the most-discussed ones), each with its live verdict and decider.
  const recapLi = c => {
    if (!c) return '';
    const by = c.src ? c.src + (c.srcs.length > 1 ? ' + ' + (c.srcs.length - 1) + ' more' : '')
      : 'AI guess' + (c.srcs.length ? ' (' + c.srcs.length + ' weaker stud' + (c.srcs.length > 1 ? 'ies' : 'y') + ' as context)' : '');
    return '<li>' + he(c.text) + ' <span class="v v-' + c.v + '">' + c.v + pct(c.conf) + '</span> <span class="small">· ' + he(by) + '</span></li>';
  };
  const groups = cfg.recap?.groups ?? [{ title: 'Most-discussed claims', claims: [...claims].sort((a, b) => b.a + b.n - (a.a + a.n)).slice(0, 8).map(c => c.id.split('/').pop()) }];
  const recapHtml = groups.map(g => '<h3>' + he(g.title) + '</h3><ul>' + g.claims.map(id => recapLi(cOf[t.id + '/' + id])).join('') + '</ul>').join('\n');
  const hype = lean ? claims.filter(c => lean[c.id] === 'pro-hype') : [];
  const fill = s => s.replaceAll('{hypeWrong}', hype.filter(c => c.v === 'wrong').length).replaceAll('{hypeTotal}', hype.length);
  const decided = claims.filter(c => c.src).length;
  const docsUsed = new Set(claims.flatMap(c => c.srcs)).size;

  // Lean panel (only with lean.json).
  let leanHtml = '';
  if (lean) {
    const FLIP = { pro: 'skeptic', 'pro-hype': 'calibrating', calibrating: 'pro', skeptic: 'pro', neutral: 'neutral' };
    const GROUP = { pro: 'fav', 'pro-hype': 'fav', calibrating: 'cal', skeptic: 'sk', neutral: 'neu' };
    const leanOf = a => GROUP[a.stance === 'denies' ? FLIP[lean[a.claim]] : lean[a.claim]];
    const tally = vs => { const c = { fav: 0, neu: 0, cal: 0, sk: 0, untagged: 0 }; for (const v of vs) for (const a of v.assertions ?? []) c[leanOf(a) ?? 'untagged']++; return c; };
    const stanceOf = v => { const c = tally([v]); return c.fav > c.sk ? 'fav' : c.sk > c.fav ? 'sk' : 'bal'; };
    const names = cfg.batches ?? {};
    const rows = new Map();
    for (const s of [...listSections(readText(join(dir, 'videos.txt')), 'Initial list'), ...listSections(readText(join(dir, 'blogs.txt')), 'Initial posts')]) {
      const label = names[s.label] ?? s.label;
      const vs = used.filter(v => s.vids.has(v.id) || (v.url && !/^[\w-]{11}$/.test(v.id) && s.urls.has(v.url)));
      rows.set(label, [...(rows.get(label) ?? []), ...vs]);
    }
    rows.set('All', used);
    const bar = c => { const n = c.fav + c.neu + c.cal + c.sk || 1, p = x => Math.round(100 * x / n);
      return '<div class="lean" role="img" aria-label="' + p(c.fav) + '% favourable, ' + p(c.neu) + '% neutral, ' + p(c.cal) + '% calibrating, ' + p(c.sk) + '% skeptical">'
        + '<span class="l-pro" style="width:' + p(c.fav) + '%"></span><span class="l-neu" style="width:' + p(c.neu) + '%"></span><span class="l-cal" style="width:' + p(c.cal) + '%"></span><span class="l-sk" style="width:' + p(c.sk) + '%"></span></div>'
        + '<span class="small">' + p(c.fav) + '% favourable · ' + p(c.neu) + '% neutral · ' + p(c.cal) + '% calibrating · ' + p(c.sk) + '% skeptical (' + n + ' claims made)</span>'; };
    const stances = vs => { const s = { fav: 0, bal: 0, sk: 0 }; for (const v of vs) s[stanceOf(v)]++; return s.fav + ' favourable · ' + s.bal + ' balanced · ' + s.sk + ' skeptical'; };
    const table = [...rows].filter(([, vs]) => vs.length).map(([k, vs]) => '<tr><td>' + he(k) + ' <span class="small">(' + vs.length + ')</span></td><td>' + bar(tally(vs)) + '</td><td class="small">' + stances(vs) + '</td></tr>').join('');
    const LEANNAME = { pro: 'Favourable', 'pro-hype': 'Favourable, sweeping', calibrating: 'Calibrating', skeptic: 'Skeptical', neutral: 'Neutral' };
    const outcome = l => { const cs = claims.filter(c => lean[c.id] === l), n = cs.length || 1, p = x => Math.round(100 * cs.filter(c => c.v === x).length / n);
      return cs.length ? '<tr><td>' + LEANNAME[l] + ' <span class="small">(' + cs.length + ')</span></td><td class="num">' + p('right') + '%</td><td class="num">' + p('partly') + '%</td><td class="num">' + p('wrong') + '%</td></tr>' : ''; };
    const untagged = claims.filter(c => !lean[c.id]).length;
    leanHtml = `<section>
  <h2>Which way the corpus leans</h2>
  <p class="small">Each claim is tagged by which way it would cut <em>if true</em>. <span style="color:var(--right)">Favourable</span>: more capable or beneficial. <span style="color:var(--partly)">Calibrating</span>: a benefit is real but smaller or mismeasured. <span style="color:var(--wrong)">Skeptical</span>: harm, risk, cost or a real limit. Neutral: practice, tools and framing. Denying a claim flips it; denying a sweeping favourable claim counts as calibrating. This shows what gets <em>talked about</em>, not what is true. The last column rates each source by its favourable minus skeptical claims.</p>
  <div class="table"><table><thead><tr><th>Batch</th><th>Claims made</th><th>Sources</th></tr></thead><tbody>${table}</tbody></table></div>
  <h3>How each kind of claim holds up</h3>
  <div class="table"><table><thead><tr><th>Claims</th><th>Right</th><th>Partly</th><th>Wrong</th></tr></thead><tbody>${['pro', 'pro-hype', 'calibrating', 'skeptic', 'neutral'].map(outcome).join('')}</tbody></table></div>
  <p class="small">Sweeping favourable claims are where most "wrong" verdicts land; skeptical and calibrating claims are mostly "this risk exists" or "smaller than claimed", which are easy to be right about.${untagged ? ' ' + untagged + ' newer claims are not tagged yet.' : ''}</p>
</section>`;
  }
  const superseded = recs.filter(v => v.supersededBy);
  const supHtml = superseded.length ? '<h3>Changed minds</h3><p class="small">When a speaker later reverses a position, the older source is superseded: it stays listed but no longer counts toward claims, novelty or the lean. Evidence recorded on it still counts.</p><ul>'
    + superseded.map(v => '<li>' + he(v.title) + ' → superseded by ' + he(recOf[v.supersededBy]?.title ?? v.supersededBy) + '</li>').join('') + '</ul>' : '';

  const ids = x => (x || []).map(c => (typeof c === 'string' ? c : c.id));
  const data = { claims: claims.map(({ ev, pr, ...c }) => c), videos, wrong: ids(t.commonlyWrong), contested: ids(t.contested) };
  const label = t.label ?? name;
  const body = `<nav class="crumbs"><a href="../index.html">All subjects</a> / ${he(label)}</nav>
<header>
  <div class="meta">${he(name)}</div>
  <h1>What ${used.length} videos and posts claim about ${he(label)}</h1>
  <p class="lede">${claims.length} canonical claims from ${nVid} YouTube videos and ${nArt} blog posts${r.videos.length - videos.length ? ' (' + (r.videos.length - videos.length) + ' more videos had no captions)' : ''}. Every claim has an AI guess: a verdict from the AI's general knowledge, with a one-line reason.${docsUsed ? ' Claims that the ' + docsUsed + ' studies and reports in the sources folder speak to also carry study verdicts that cite line ranges.' : ''}</p>
</header>

<section>
  <h2>Recap</h2>
  <p>${used.length} videos and posts making ${claims.length} distinct claims${docsUsed ? ', checked against ' + docsUsed + ' studies and reports. Studies decide ' + decided + ' claims; the rest use an AI guess, which counts for at most 50% confidence. ' + changed.length + ' AI guesses were overturned by a study.' : '. No studies have been checked yet, so every verdict is an AI guess.'}</p>
  ${cfg.recap?.bottomLine ? '<p><strong>Bottom line:</strong> ' + fill(cfg.recap.bottomLine) + '</p><p class="small">The verdicts below update automatically as evidence is added; the bottom line is a hand-written summary of them.</p>' : ''}
${recapHtml}
</section>

<section>
  <h2>Five most worth your time</h2>
  <p class="small">Ranked by score, then novelty (rare claims that hold up, weighted by verdict confidence).</p>
  <ol>
${top5}
  </ol>
  ${runners ? '<p class="small">Next: ' + runners + '.</p>' : ''}
</section>

${surp.length ? `<section>
  <h2>What the studies changed</h2>
  <p class="small">Each claim first got an <em>AI guess</em>, then was checked against the studies. Listed: claims where a study pointed a different way. An AI guess counts for at most 50% confidence; a study at least that confident replaces it, a weaker one is shown as context. Biggest changes first.</p>
  <h3>Verdict changed by a study (${changed.length})</h3>
  <ul>
${changed.map(surpLi).join('\n')}
  </ul>
  ${held.length ? '<details><summary class="small">' + held.length + ' more where a study disagreed but was less confident, so the AI guess stands</summary><ul>\n' + held.map(surpLi).join('\n') + '\n</ul></details>' : ''}
</section>` : ''}

${leanHtml}
${supHtml ? '<section>' + supHtml + '</section>' : ''}

<section>
  <h2>Judged wrong</h2>
  <p class="small">The claim's deciding verdict is "wrong". The stat line shows whether a study decided it or only the AI guess.</p>
  <div id="wrong"></div>
</section>

<section>
  <h2>Contested</h2>
  <p class="small">Claims some sources assert and others deny.</p>
  <div id="contested"></div>
</section>

<section>
  <h2>All claims</h2>
  <div class="filters" role="group" aria-label="Filter by verdict"><input id="q" type="search" placeholder="Search claims" aria-label="Search claims"></div>
  <div id="all"></div>
</section>

<section>
  <h2>Videos and posts</h2>
  <p class="small">Score: −1 mostly wrong, 0 mixed, 1 mostly right, 2 right, from the verdicts on the claims each source makes. Novelty adds up, for each claim a source gets right or correctly refutes, the verdict's confidence divided by how many sources take the same stance; 1 is about one unique, well-supported point.</p>
  <div class="table"><table class="vtbl"><thead><tr><th>Score</th><th>Source</th><th>Novelty</th><th>Verdict</th></tr></thead><tbody id="vids"></tbody></table></div>
</section>`;

  const script = `<script>
const D = ${esc(JSON.stringify(data))};
const ICON = ${esc(JSON.stringify(ICON))};
const byId = Object.fromEntries(D.claims.map(c => [c.id, c]));
const h = s => String(s).replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
const card = c => '<div class="claim"><div class="row"><p>' + h(c.text) + '</p><span class="v v-' + c.v + '">' + c.v + (c.conf != null ? ' ' + Math.round(c.conf * 100) + '%' : '') + '</span></div>'
  + '<p class="note">' + h(c.note) + '</p><span class="stat">asserted ' + c.a + ' · denied ' + c.n + (c.src ? ' · decided by study: ' + h(c.src) + (c.srcs.length > 1 ? ' (+' + (c.srcs.length - 1) + ' more)' : '')
    : c.srcs.length ? ' · AI guess stands; ' + c.srcs.length + ' stud' + (c.srcs.length > 1 ? 'ies' : 'y') + ' as context' : ' · AI guess only') + '</span></div>';
document.getElementById('wrong').innerHTML = D.wrong.map(i => card(byId[i])).join('') || '<p class="small">None.</p>';
document.getElementById('contested').innerHTML = D.contested.map(i => card(byId[i])).join('') || '<p class="small">None.</p>';
let filter = 'all';
const fbox = document.querySelector('.filters');
for (const v of ['all', 'right', 'partly', 'wrong', 'untestable', 'unknown']) {
  const n = v === 'all' ? D.claims.length : D.claims.filter(c => c.v === v).length;
  if (!n) continue;
  const b = document.createElement('button');
  b.type = 'button'; b.textContent = v + ' (' + n + ')'; b.setAttribute('aria-pressed', v === filter);
  b.onclick = () => { filter = v; fbox.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b)); render(); };
  fbox.appendChild(b);
}
const q = document.getElementById('q');
q.oninput = render;
function render() {
  const s = q.value.toLowerCase();
  const list = D.claims.filter(c => (filter === 'all' || c.v === filter) && (!s || (c.text + ' ' + c.note).toLowerCase().includes(s))).sort((a, b) => (b.a + b.n) - (a.a + a.n));
  document.getElementById('all').innerHTML = list.map(card).join('') || '<p class="small">No claims match.</p>';
}
render();
document.getElementById('vids').innerHTML = D.videos.sort((a, b) => (b.s ?? -2) - (a.s ?? -2) || b.nov - a.nov).map(v =>
  '<tr' + (v.w.startsWith('superseded') ? ' class="sup"' : '') + '><td class="num sc sc-' + v.s + '">' + (v.s == null ? '–' : (v.s > 0 ? '+' : '') + v.s) + '</td><td>' + (v.art ? ICON.post : ICON.video) + '<a href="' + h(v.href) + '">' + h(v.title) + '</a><br><span class="small">' + h(v.ch) + '</span></td><td class="num">' + v.nov.toFixed(2) + '</td><td class="small">' + h(v.w) + '</td></tr>'
).join('');
</script>`;

  mkdirSync(join(OUT, name), { recursive: true });
  writeFileSync(join(OUT, name, 'index.html'), page({ title: label + ' · claims', body, script }));
  return { name, label, sources: used.length, claims: claims.length, docs: docsUsed, decided, bottomLine: cfg.recap?.bottomLine ? fill(cfg.recap.bottomLine) : '' };
}

// Empty _site/ rather than deleting it, so a local preview server holding the folder open doesn't block a rebuild.
mkdirSync(OUT, { recursive: true });
for (const f of readdirSync(OUT)) rmSync(join(OUT, f), { recursive: true, force: true });
const subjects = readdirSync(ROOT, { withFileTypes: true })
  .filter(d => d.isDirectory() && !d.name.startsWith('.') && !['node_modules', 'scripts', '_site'].includes(d.name) && existsSync(join(ROOT, d.name, 'report.json')))
  .map(d => buildSubject(join(ROOT, d.name), d.name))
  .filter(Boolean);
const cards = subjects.map(s => `<a class="card" href="${he(s.name)}/index.html">
  <h2>${he(s.label)}</h2>
  <span class="stats">${s.sources} sources · ${s.claims} claims · ${s.docs} studies</span>
  ${s.bottomLine ? '<span class="small">' + he(s.bottomLine[0].toUpperCase() + s.bottomLine.slice(1).split('. ')[0]) + '.</span>' : ''}
</a>`).join('\n');
writeFileSync(join(OUT, 'index.html'), page({ title: 'Video knowledge', body: `<header>
  <div class="meta">Video knowledge</div>
  <h1>What videos and posts claim, checked against the evidence</h1>
  <p class="lede">Each subject collects YouTube videos and blog posts, extracts the claims they make, and judges every claim: first by an AI guess, then against studies where they exist. Pick a subject.</p>
</header>
<section class="cards">
${cards || '<p class="small">No subjects have a report yet. Run <code>npm run report</code>.</p>'}
</section>` }));
console.log('built _site/ with', subjects.map(s => `${s.name} (${s.claims} claims)`).join(', ') || 'no subjects');
