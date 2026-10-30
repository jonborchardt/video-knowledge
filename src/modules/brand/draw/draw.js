/* global window, document */
// The brand kit's drawings: one design per slot in brand/slots.json, the same for the Commonwealth and every institution,
// drawn from the brand's kit.json (palette, emblem, slogan) and its names in src/config/site.ts. Runs in the browser
// that src/modules/brand/cli.ts opens, so text is measured in the real fonts (fitText) before the SVGs are saved.
// window.BrandKit.assets(brand) -> [{ slot, key, w, h, svg }]; key is the ground or form of a slot that ships several.
(() => {
  const RED = '#9b2f2a'; // stamp ink for the official acts (recorded, amended)
  const SERIF = 'font-family="\'Libre Baskerville\', Georgia, serif"';
  const MONO = 'font-family="\'IBM Plex Mono\', monospace"';
  const PARENT = 'COMMONWEALTH OF REASON';
  const SITE = 'commonwealthofreason.com';

  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const mix = (h, t, f) =>
    '#' +
    hex(h)
      .map((v, i) =>
        Math.round(v + (hex(t)[i] - v) * f)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('');
  // WCAG relative luminance and contrast ratio
  const lum = (h) =>
    hex(h)
      .map((v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      .reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
  const contrast = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };
  let uid = 0;
  const nid = (p) => p + ++uid;
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const caps = (s) => s.replace(/\.$/, '').toUpperCase();

  // Every exported SVG carries its own defs: the brand's engraved-gold gradient, paper grain, stamp distress.
  const defs = (k) => {
    const a = k.accent;
    return `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${mix(a, '#ffffff', 0.35)}"/><stop offset=".45" stop-color="${a}"/><stop offset=".55" stop-color="${mix(a, '#000000', 0.25)}"/><stop offset="1" stop-color="${mix(a, '#ffffff', 0.2)}"/></linearGradient>
<filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -.9 .55"/></filter>
<filter id="rough" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -1.7 0 0 0 1.75" result="m"/><feComposite in="SourceGraphic" in2="m" operator="in" result="s"/><feTurbulence type="turbulence" baseFrequency=".04" numOctaves="2" result="w"/><feDisplacementMap in="s" in2="w" scale="4"/></filter></defs>`;
  };

  // Emblems are drawn in a -50..50 box and stroked.
  const EMBLEM = {
    cor: `<path d="M0 -46 L7 -7 L46 0 L7 7 L0 46 L-7 7 L-46 0 L-7 -7 Z"/><path d="M0 -24 L4 -4 L24 0 L4 4 L0 24 L-4 4 L-24 0 L-4 -4 Z" transform="rotate(45)"/><circle r="5"/><circle r="30" fill="none"/>`,
    spending: `<path d="M0 -36 V34 M-20 38 H20 M-12 34 H12 M-36 -24 H36 M-36 -24 L-46 4 M-36 -24 L-26 4 M36 -24 L26 4 M36 -24 L46 4" fill="none"/><path d="M-48 4 Q-36 16 -24 4 Z M24 4 Q36 16 48 4 Z"/><circle cy="-38" r="4"/><rect x="-43" y="-6" width="14" height="9" fill="none"/><path d="M27 -2 h18 M27 -6 h18 M28 -10 h16" fill="none"/>`,
    'dubious-returns': `<circle cx="-10" cy="-6" r="28" fill="none"/><circle cx="-10" cy="-6" r="22" fill="none"/><path d="M-18 -14 q8 -10 16 0 q2 8 -8 12 v6 M-10 12 v3" fill="none"/><circle cx="22" cy="22" r="13" fill="none"/><path d="M31 31 L44 44" fill="none" stroke-width="6"/>`,
    'code-pending': `<path d="M-18 -28 L-42 0 L-18 28 M18 -28 L42 0 L18 28 M9 -32 L-9 32" fill="none"/><rect x="-6" y="34" width="12" height="5"/>`,
    plausibility: `<path d="M-40 18 A40 40 0 0 1 40 18" fill="none"/><path d="M-34 -2 l6 3 M-20 -18 l4 5 M0 -24 v6 M20 -18 l-4 5 M34 -2 l-6 3" fill="none"/><path d="M0 18 L20 -14" fill="none" stroke-width="4"/><circle cy="18" r="6"/><path d="M-30 32 H30" fill="none"/>`,
    'public-beliefs': `<circle r="9"/><circle r="22" fill="none"/><circle r="36" fill="none" stroke-dasharray="3 6"/><circle cx="22" r="3"/><circle cx="-11" cy="19" r="3"/><circle cx="-11" cy="-19" r="3"/><path d="M26 30 L38 44 L42 26" fill="none"/>`,
    'synthetic-arts': `<path d="M-46 -16 H46 M-46 -8 H46 M-46 0 H46 M-46 8 H46 M-46 16 H46" fill="none" stroke-width="1.2"/><path d="M-46 0 C-34 -36 -22 -36 -12 0 S10 36 20 0 S40 -30 46 -8" fill="none" stroke-width="4.5"/>`,
  };

  // Text sizes start from an estimate and carry their box (data-maxw); fitText shrinks what the real font overflows.
  const fitN = (t, w, max, ls) => Math.min(max, (w / t.length - ls) / 0.72);
  const fit = (t, w, max, r = 0.56) => `${Math.min(max, w / (t.length * r)).toFixed(1)}" data-maxw="${w}`;
  function fitText(root) {
    // A wrapped block (data-wrap: at most that many lines inside data-maxw, centred in data-box below data-top) shrinks
    // one step at a time until it fits, then becomes one tspan per line.
    for (const el of root.querySelectorAll('text[data-wrap]')) {
      const max = +el.dataset.maxw,
        most = +el.dataset.wrap,
        lh = 1.22,
        words = el.textContent.split(/\s+/).filter(Boolean);
      const len = (s) => ((el.textContent = s), el.getComputedTextLength());
      let size = +el.getAttribute('font-size'),
        lines;
      for (; ; size -= 1) {
        el.setAttribute('font-size', size);
        lines = [];
        for (const w of words) {
          const next = lines.length ? `${lines[lines.length - 1]} ${w}` : w;
          if (lines.length && len(next) <= max) lines[lines.length - 1] = next;
          else lines.push(w);
        }
        const fits = lines.length <= most && lines.every((l) => len(l) <= max);
        if (fits) break;
        if (size <= 12) throw new Error(`does not fit in ${most} lines at 12px: ${words.join(' ')}`);
      }
      const top = +el.dataset.top + (+el.dataset.box - lines.length * size * lh) / 2 + size * 0.8;
      el.textContent = '';
      lines.forEach((l, i) => {
        const span = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
        span.setAttribute('x', el.getAttribute('x'));
        span.setAttribute('y', (top + i * size * lh).toFixed(1));
        span.textContent = l;
        el.appendChild(span);
      });
      for (const k of ['wrap', 'maxw', 'top', 'box']) el.removeAttribute(`data-${k}`);
    }
    for (const el of root.querySelectorAll('text[data-maxw]')) {
      const max = +el.dataset.maxw;
      const len = el.getComputedTextLength();
      if (len > max)
        el.setAttribute('font-size', (((parseFloat(el.getAttribute('font-size')) * max) / len) * 0.98).toFixed(1));
      el.removeAttribute('data-maxw');
    }
  }

  const T = (x, y, size, txt, fill, o = '') =>
    `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" ${o}>${esc(txt)}</text>`;
  const place = (inner, x, y, size) => `<g transform="translate(${x} ${y}) scale(${size / 1000})">${inner}</g>`;
  const grain = (w, h, o = 1) => `<rect width="${w}" height="${h}" filter="url(#grain)" opacity="${o}"/>`;
  const rules = (x, y, w, c, gap = 10) =>
    `<path d="M${x} ${y} H${x + w} M${x} ${y + gap} H${x + w}" stroke="${c}" stroke-width="${gap > 6 ? 3 : 1.5}" fill="none"/><path d="M${x} ${y + gap} H${x + w}" stroke="${c}" stroke-width="1" fill="none"/>`;
  const frame = (w, h, c, inset = 24) =>
    `<rect x="${inset}" y="${inset}" width="${w - inset * 2}" height="${h - inset * 2}" fill="none" stroke="${c}" stroke-width="4"/><rect x="${inset + 12}" y="${inset + 12}" width="${w - inset * 2 - 24}" height="${h - inset * 2 - 24}" fill="none" stroke="${c}" stroke-width="1.5"/>`;

  function assets(B) {
    const k = B.palette;
    const emblem = (color, s = 1, sw = 3) =>
      `<g transform="scale(${s})" fill="${color}" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${EMBLEM[B.key]}</g>`;

    // The seal (engraved ring), in a 1000 box: the name over the top, the brand's own motto along the bottom.
    function seal(ink, fillc) {
      const a = nid('ta'),
        c = nid('tb'),
        top = B.ringTop,
        bottom = caps(B.tagline);
      return `<circle cx="500" cy="500" r="488" fill="${fillc || 'none'}" stroke="${ink}" stroke-width="16"/><circle cx="500" cy="500" r="458" fill="none" stroke="${ink}" stroke-width="3"/><circle cx="500" cy="500" r="318" fill="none" stroke="${ink}" stroke-width="3"/><circle cx="500" cy="500" r="306" fill="none" stroke="${ink}" stroke-width="1.5"/>
<path id="${a}" d="M110 500 A390 390 0 0 1 890 500" fill="none"/><path id="${c}" d="M90 500 A410 410 0 0 0 910 500" fill="none"/>
<text ${SERIF} font-size="${fitN(top, 1150, 50, 7).toFixed(1)}" letter-spacing="7" fill="${ink}" text-anchor="middle"><textPath href="#${a}" startOffset="50%">${esc(top)}</textPath></text>
<text ${SERIF} font-size="${fitN(bottom, 1250, 34, 6).toFixed(1)}" letter-spacing="6" fill="${ink}" text-anchor="middle" dominant-baseline="hanging"><textPath href="#${c}" startOffset="50%">${esc(bottom)}</textPath></text>
<g transform="translate(500 500)">${emblem(ink, 4.6, 2.6)}</g>`;
    }
    const gold = (fill = k.ground) => seal('url(#g)', fill);

    // Stamps: one ink by meaning, a rectangle where there is room and a circle where it is small, on paper and on the
    // brand's ground. On the ground, record and finding go in paper ink; amended and examination keep their meaning in
    // a light red and a light slate while those clear 3:1 against the ground, else paper too.
    const light = (want) => (contrast(want, k.ground) >= 3 ? want : k.paper);
    const STAMPS = {
      'stamp-record': {
        ink: RED,
        dark: k.paper,
        big: 'PUBLIC RECORD',
        small: 'ENTERED INTO THE',
        ring: `ENTERED INTO THE PUBLIC RECORD · ${B.short.toUpperCase()} · `,
        center: 'RECORDED',
      },
      'stamp-finding': {
        ink: k.ground,
        dark: k.paper,
        big: 'FINDING',
        small: `OF THE ${B.body.toUpperCase()}`,
        ring: `FINDING OF THE ${B.body.toUpperCase()} · `,
        center: 'FINDING',
      },
      'stamp-amended': {
        ink: RED,
        dark: light(mix(RED, '#ffffff', 0.45)),
        big: 'AMENDED',
        small: 'SEE ERRATUM · DATED',
        ring: 'AMENDED FINDING · ERRATUM ENTERED · ',
        center: 'AMENDED',
      },
      'stamp-examination': {
        ink: k.ink,
        dark: light(mix(k.ink, '#ffffff', 0.6)),
        big: 'UNDER EXAMINATION',
        small: `MATTER BEFORE THE ${B.body.toUpperCase()}`,
        ring: 'UNDER EXAMINATION · EVIDENCE BEING WEIGHED · ',
        center: 'PENDING',
      },
    };
    function stampRect(w, h, { big, small, ink }, rot) {
      return (
        `<g transform="rotate(${rot} ${w / 2} ${h / 2})" filter="url(#rough)"><rect x="${w * 0.06}" y="${h * 0.14}" width="${w * 0.88}" height="${h * 0.72}" rx="10" fill="none" stroke="${ink}" stroke-width="10"/><rect x="${w * 0.06 + 18}" y="${h * 0.14 + 18}" width="${w * 0.88 - 36}" height="${h * 0.72 - 36}" rx="4" fill="none" stroke="${ink}" stroke-width="3"/>` +
        T(w / 2, h * 0.38, h * 0.085, small, ink, `${MONO} text-anchor="middle" letter-spacing="8" font-weight="500"`) +
        T(
          w / 2,
          h * 0.62,
          fit(big, w * 0.8, h * 0.17, 0.8),
          big,
          ink,
          `${SERIF} text-anchor="middle" font-weight="700" letter-spacing="4"`,
        ) +
        '</g>'
      );
    }
    function stampRound(s, { ring, center, ink }, rot, onInk = '#f6f1e6') {
      const r = s * 0.42,
        c = s / 2,
        a = nid('sr');
      return (
        `<g transform="rotate(${rot} ${c} ${c})" filter="url(#rough)"><circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${ink}" stroke-width="9"/><circle cx="${c}" cy="${c}" r="${r * 0.72}" fill="none" stroke="${ink}" stroke-width="3"/>
<path id="${a}" d="M${c - r * 0.85} ${c} A${r * 0.85} ${r * 0.85} 0 1 1 ${c + r * 0.85} ${c} A${r * 0.85} ${r * 0.85} 0 1 1 ${c - r * 0.85} ${c}" fill="none"/>
<text ${MONO} font-size="${Math.min(r * 0.14, ((2 * Math.PI * r * 0.85 * 0.97) / ring.length - 5) / 0.6).toFixed(1)}" letter-spacing="5" fill="${ink}" font-weight="500"><textPath href="#${a}">${esc(ring)}</textPath></text>
<rect x="${c - r * 1.05}" y="${c - r * 0.2}" width="${r * 2.1}" height="${r * 0.4}" fill="${ink}"/>` +
        T(
          c,
          c + r * 0.02,
          r * 0.24,
          center,
          onInk,
          `${SERIF} text-anchor="middle" dominant-baseline="middle" font-weight="700" letter-spacing="3"`,
        ) +
        '</g>'
      );
    }

    const out = [];
    // w x h is the drawing (viewBox); size the exported pixel size when it differs.
    const add = (slot, key, w, h, body, size = [w, h]) =>
      out.push({
        slot,
        key,
        w: size[0],
        h: size[1],
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${size[0]}" height="${size[1]}">${defs(k)}${body}</svg>`,
      });
    // A slot that ships on both grounds: the same design inked for paper and for ground. `bg` keeps the surface.
    const grounds = (slot, w, h, draw, bg = false, size) => {
      add(
        slot,
        'paper',
        w,
        h,
        (bg ? `<rect width="${w}" height="${h}" fill="${k.paper}"/>${grain(w, h, 0.5)}` : '') +
          draw(k.ground, k.ink, true),
        size,
      );
      add(
        slot,
        'ground',
        w,
        h,
        (bg ? `<rect width="${w}" height="${h}" fill="${k.ground}"/>` : '') + draw(k.paper, k.accent, false),
        size,
      );
    };
    const n = B.nameLines.length;

    // Marks
    add('seal', null, 1000, 1000, gold(), [1024, 1024]);
    grounds('seal-mono', 1000, 1000, (fg) => seal(fg, null), false, [1024, 1024]);
    add(
      'mark-small',
      null,
      64,
      64,
      `<circle cx="32" cy="32" r="31" fill="${k.ground}"/><circle cx="32" cy="32" r="27.5" fill="none" stroke="${k.accent}" stroke-width="2"/><g transform="translate(32 33)">${emblem(k.accent, 0.44, 4.5)}</g>`,
    );
    grounds(
      'lockup-horizontal',
      1600,
      400,
      (fg, sub) =>
        place(gold(), 60, 50, 300) +
        T(410, 150, 30, PARENT, sub, `${MONO} letter-spacing="9"`) +
        T(408, 238, fit(B.name, 1130, 70), B.name, fg, SERIF) +
        `<path d="M410 272 H1540" stroke="${k.accent}" stroke-width="2"/>` +
        T(410, 320, fit(B.tagline, 1130, 30), B.tagline, sub, `${SERIF} font-style="italic"`),
    );
    grounds(
      'lockup-stacked',
      800,
      1000,
      (fg, sub) =>
        place(gold(), 190, 70, 420) +
        T(400, 600, 24, PARENT, sub, `${MONO} text-anchor="middle" letter-spacing="7"`) +
        B.nameLines
          .map((l, i) => T(400, 680 + i * 66, fit(l, 700, 54), l, fg, `${SERIF} text-anchor="middle"`))
          .join('') +
        `<path d="M260 ${700 + n * 66 - 20} H540" stroke="${k.accent}" stroke-width="2"/>` +
        T(
          400,
          760 + n * 66 - 20,
          fit(B.tagline, 680, 24, 0.8),
          caps(B.tagline),
          sub,
          `${MONO} text-anchor="middle" letter-spacing="4"`,
        ),
    );
    grounds(
      'wordmark',
      1600,
      240,
      (fg, sub) =>
        T(80, 92, 26, PARENT, sub, `${MONO} letter-spacing="10"`) +
        T(78, 178, fit(B.name, 1440, 72, 0.52), B.name, fg, `${SERIF} font-style="italic"`),
    );

    // Stamps and emboss
    grounds(
      'emboss',
      1000,
      1000,
      (fg, sub, onPaper) => {
        const hi = onPaper ? ['#ffffff', 0.9] : ['#ffffff', 0.12],
          lo = onPaper ? [k.ink, 0.28] : ['#000000', 0.45];
        return place(
          `<g transform="translate(-4 -4)" opacity="${hi[1]}">${seal(hi[0], null)}</g><g transform="translate(4 4)" opacity="${lo[1]}">${seal(lo[0], null)}</g>` +
            (onPaper ? seal(k.paper, null) : ''),
          80,
          80,
          840,
        );
      },
      true,
      [1024, 1024],
    );
    for (const [slot, w] of [
      ['stamp-record', 1200],
      ['stamp-finding', 800],
      ['stamp-amended', 800],
      ['stamp-examination', 1200],
    ]) {
      const dark = { ...STAMPS[slot], ink: STAMPS[slot].dark };
      add(slot, 'rect-paper', w, 400, stampRect(w, 400, STAMPS[slot], -3));
      add(slot, 'round-paper', 400, 400, stampRound(400, STAMPS[slot], 6));
      add(slot, 'rect-ground', w, 400, stampRect(w, 400, dark, -3));
      add(slot, 'round-ground', 400, 400, stampRound(400, dark, 6, k.ground));
    }

    // Headers and banners
    add(
      'youtube-banner',
      null,
      2560,
      1440,
      `<rect width="2560" height="1440" fill="${k.ground}"/><rect x="0" y="470" width="2560" height="500" fill="${k.paper}"/>${grain(2560, 1440, 0.35)}` +
        rules(0, 452, 2560, k.accent) +
        rules(0, 978, 2560, k.accent) +
        place(gold(), 560, 525, 390) +
        T(1010, 620, 34, PARENT, k.ink, `${MONO} letter-spacing="12"`) +
        T(1006, 735, fit(B.name, 1040, 96), B.name, k.ground, SERIF) +
        `<path d="M1010 780 H2000" stroke="${k.accent}" stroke-width="3"/>` +
        T(1010, 850, fit(B.tagline, 1040, 40), B.tagline, k.ink, `${SERIF} font-style="italic"`),
    );
    add(
      'x-header',
      null,
      1500,
      500,
      `<rect width="1500" height="500" fill="${k.ground}"/>${rules(0, 40, 1500, k.accent)}${rules(0, 450, 1500, k.accent)}` +
        T(1420, 210, 26, PARENT, k.accent, `${MONO} text-anchor="end" letter-spacing="9"`) +
        T(1420, 300, fit(B.name, 1000, 62), B.name, k.paper, `${SERIF} text-anchor="end"`) +
        T(1420, 360, fit(B.tagline, 1000, 26), B.tagline, k.accent, `${SERIF} text-anchor="end" font-style="italic"`),
    );
    add(
      'page-band',
      null,
      1600,
      320,
      `<rect width="1600" height="320" fill="${k.ground}"/><g opacity=".14">${place(seal(k.paper, null), 1180, -90, 500)}</g>` +
        T(80, 130, 22, PARENT, k.accent, `${MONO} letter-spacing="8"`) +
        T(78, 210, fit(B.name, 1080, 62), B.name, k.paper, SERIF) +
        `<path d="M80 245 H600" stroke="${k.accent}" stroke-width="2"/>`,
    );

    // Share cards (og-inquiry is a per-inquiry template, see inquiryCard)
    add(
      'og-default',
      null,
      1200,
      675,
      `<rect width="1200" height="675" fill="${k.ground}"/>` +
        frame(1200, 675, k.accent, 28) +
        place(gold(mix(k.ground, '#000000', 0.2)), 90, 177, 320) +
        T(470, 270, 22, PARENT, k.accent, `${MONO} letter-spacing="8"`) +
        B.nameLines.map((l, i) => T(468, 340 + i * 62, fit(l, 660, 54), l, k.paper, SERIF)).join('') +
        T(470, 360 + n * 62, 22, SITE, k.accent, MONO),
    );

    // Calls to action
    add(
      'cta-record',
      null,
      1200,
      400,
      `<rect width="1200" height="400" fill="${k.ground}"/>` +
        frame(1200, 400, k.accent, 16) +
        place(gold(), 70, 80, 240) +
        T(360, 160, 22, 'EXHIBITS · FINDINGS · SOURCES', k.accent, `${MONO} letter-spacing="6"`) +
        T(358, 240, 64, 'Read the full record', k.paper, SERIF) +
        T(360, 300, 26, SITE, k.accent, MONO) +
        `<path d="M1040 200 h70 m-26 -26 l26 26 l-26 26" stroke="${k.accent}" stroke-width="6" fill="none"/>`,
    );
    add(
      'cta-watch',
      null,
      1200,
      400,
      `<rect width="1200" height="400" fill="${k.ground}"/>` +
        place(gold(mix(k.ground, '#000000', 0.2)), 60, 60, 280) +
        `<circle cx="200" cy="200" r="70" fill="${k.paper}" opacity=".95"/><path d="M178 160 L238 200 L178 240 Z" fill="${k.ground}"/>` +
        T(390, 170, 22, 'PUBLIC INFORMATION FILM', k.accent, `${MONO} letter-spacing="7"`) +
        T(388, 250, 66, 'Watch the inquiry', k.paper, SERIF) +
        T(390, 310, fit(B.handle || B.fullName, 760, 26, 0.62), B.handle || B.fullName, k.accent, MONO),
    );
    add(
      'endscreen-subscribe',
      null,
      1920,
      1080,
      `<rect width="1920" height="1080" fill="${k.ground}"/><g opacity=".1">${place(seal(k.paper, null), -180, 120, 1100)}</g>` +
        T(110, 250, 30, PARENT, k.accent, `${MONO} letter-spacing="10"`) +
        B.nameLines.map((l, i) => T(108, 340 + i * 80, 70, l, k.paper, SERIF)).join(''),
    );
    add(
      'close-card',
      null,
      1920,
      1080,
      `<rect width="1920" height="1080" fill="${k.ground}"/>` +
        frame(1920, 1080, k.accent, 40) +
        place(gold(), 810, 150, 300) +
        T(960, 600, 64, 'The matter is now part', k.paper, `${SERIF} text-anchor="middle"`) +
        T(960, 690, 64, 'of the public record.', k.paper, `${SERIF} text-anchor="middle"`) +
        T(
          960,
          800,
          fit(`${PARENT} · ${B.name.toUpperCase()}`, 1700, 28, 0.8),
          B.key === 'cor' ? caps(B.tagline) : `${PARENT} · ${B.name.toUpperCase()}`,
          k.accent,
          `${MONO} text-anchor="middle" letter-spacing="6"`,
        ) +
        T(960, 900, 26, B.disclosure, k.accent, `${SERIF} text-anchor="middle" font-style="italic"`),
    );

    // Avatars and video
    add('avatar', null, 800, 800, `<rect width="800" height="800" fill="${k.ground}"/>` + place(gold(), 40, 40, 720));
    add(
      'watermark',
      null,
      150,
      150,
      `<g opacity=".6"><circle cx="75" cy="75" r="66" fill="none" stroke="#fff" stroke-width="5"/><g transform="translate(75 77)">${emblem('#fff', 1, 4.5)}</g></g>`,
    );
    add(
      'thumbnail-badge',
      null,
      240,
      240,
      `<path d="M0 0 H240 V120 L120 240 H0 Z" fill="${k.ground}"/><g transform="translate(84 84)">${emblem(k.accent, 1.15, 4)}</g>` +
        T(16, 214, 20, 'COR', k.accent, `${MONO} letter-spacing="3" font-weight="500"`),
    );
    return out;
  }

  // The og-inquiry template, "Ground, question first": one story's question in large serif on the brand's ground, a
  // gold rule, the seal, the full institution name and THE OFFICIAL PUBLIC RECORD. fitText wraps the question.
  function inquiryCard(B, question) {
    const k = B.palette;
    return {
      w: 1200,
      h: 675,
      svg:
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675" width="1200" height="675">${defs(k)}` +
        `<rect width="1200" height="675" fill="${k.ground}"/>` +
        frame(1200, 675, k.accent, 28) +
        T(96, 128, 22, 'THE OFFICIAL PUBLIC RECORD', k.accent, `${MONO} letter-spacing="8"`) +
        T(
          96,
          0,
          `62" data-wrap="4" data-maxw="1008" data-top="150" data-box="350`,
          question,
          k.paper,
          `${SERIF} font-weight="700"`,
        ) +
        `<path d="M96 524 H420" stroke="${k.accent}" stroke-width="3"/>` +
        place(
          assets(B)
            .find((a) => a.slot === 'seal')
            .svg.replace(/^<svg[^>]*>|<\/svg>$/g, '')
            .replace(/<defs>[\s\S]*?<\/defs>/, ''),
          96,
          546,
          68,
        ) +
        T(184, 586, fit(B.fullName, 900, 28), B.fullName, k.paper, SERIF) +
        T(186, 618, 18, SITE, k.accent, MONO) +
        '</svg>',
    };
  }

  window.BrandKit = { assets, inquiryCard, fitText };
})();
