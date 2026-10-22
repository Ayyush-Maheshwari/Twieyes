(() => {
  'use strict';

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const body = document.body;

  const MOODS = {
    soft:      { accent: '#f2b8ae', ctl: '#f08e84' },        // accent: highlights; ctl: the on-video controls, a stronger tone of the same colour
    playful:   { accent: '#f7b685', ctl: '#f6a24f' },
    energetic: { accent: '#ff7461', ctl: '#ff5a47' },
  };

  // Three or four words, all of them kind. Order is shuffled once (fixed seed) so she
  // never sees a repeat until every line has been used.
  const QUOTES = [
    'soft day ahead', 'you glow quietly', 'be gentle today', 'small joys, yours', 'good things find you',
    'breathe, then bloom', 'sunlight suits you', 'go slow, shine', 'tiny wins count', 'just you, exactly',
    'kind eyes, always', 'wear your light', 'today is yours', 'hello, sunshine', 'all will bloom',
    'eyes like morning', 'be your softest', 'choose joy today', 'you’ve got this', 'rest is productive',
    'magic looks like you', 'stay a little curious', 'dream out loud', 'bright things ahead',
    'you’re doing beautifully', 'pocket full of sun', 'unhurried and golden', 'shine, no apology',
    'light finds you', 'bloom at your pace', 'smile, it suits you', 'gentle is strong', 'carry the good',
  ];

  // ---------- anonymous counts, so the person who made this can see how often it is opened ----------
  // Only numbers are sent (opens, which mood and song, installs), never anything about her or her device.
  // Not counted: localhost, files, ?debug, and any browser that has visited with ?me (the maker's own devices).
  const qs = new URLSearchParams(location.search);
  const counter = window.__counter;
  const isMaker = () => { try { return localStorage.getItem('cg:owner') === '1'; } catch { return false; } };
  if (qs.has('me')) { try { qs.get('me') === 'off' ? localStorage.removeItem('cg:owner') : localStorage.setItem('cg:owner', '1'); } catch { /* private mode */ } }
  const testNs = qs.has('debug') && qs.get('ns');                                   // lets me test with a throwaway label
  const counting = !!counter && !isMaker() && (testNs || (/^https?:$/.test(location.protocol) && !/^(localhost|127\.|\[::1\])/.test(location.hostname) && !qs.has('debug')));
  function count(key) {
    if (!counting) return;
    try { fetch(`${counter.base}/hit/${testNs || counter.ns}/${key}`, { mode: 'no-cors', keepalive: true, cache: 'no-store' }).catch(() => {}); } catch { /* counting must never break the page */ }
  }

  // ---------- remembered between visits (this device only) ----------

  const store = {
    get(k, d) { try { const v = localStorage.getItem('cg:' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('cg:' + k, JSON.stringify(v)); } catch { /* private mode: rotation just restarts */ } },
  };

  function seededOrder(n, seed) {
    const a = Array.from({ length: n }, (_, i) => i);
    let s = seed >>> 0;
    const rnd = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  try {
    if (!sessionStorage.getItem('cg:counted')) {
      sessionStorage.setItem('cg:counted', '1');
      const now = new Date();
      count('opens');
      count('day-' + now.toISOString().slice(0, 10));                                   // per day (UTC date)
      count('time-' + Math.floor(now.getHours() / 3));                                   // her local time of day in 3-hour blocks (0 = midnight to 3am)
    }
  } catch { /* private mode: count every load instead */ count('opens'); }

  const visit = store.get('visit', 0);
  store.set('visit', visit + 1);
  const quoteOrder = seededOrder(QUOTES.length, 7);
  let quoteAt = visit % QUOTES.length;
  const setQuoteText = (s) => $$('.q').forEach((el) => { el.textContent = s; });
  setQuoteText(QUOTES[quoteOrder[quoteAt]]);

  // every 15 s the line changes by itself: the old one leaves, the next one rises in
  function swapQuote() {
    if (document.hidden) return;
    quoteAt += 1;
    const next = QUOTES[quoteOrder[quoteAt % QUOTES.length]];
    const els = $$('.q');
    els.forEach((el) => el.classList.add('out'));
    setTimeout(() => {
      els.forEach((el) => { el.textContent = next; el.classList.add('pre'); el.classList.remove('out'); });
      void document.body.offsetWidth;                      // let the new text sit below before it rises
      els.forEach((el) => el.classList.remove('pre'));
    }, reduceMotion ? 120 : 400);
  }
  setInterval(swapQuote, 15000);

  // the greeting follows her clock: morning, afternoon, evening, night; every third visit it is a plain "Hi"
  function greetingFor(date, n) {
    const h = date.getHours();
    const timed = h < 5 ? 'Hey, night owl' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';   // no "good night": that is a goodbye, not a hello
    return n % 3 === 2 ? 'Hi' : timed;
  }
  // the name slot alternates: her name, then a playful lawyer's title, then her name again... (she is an attorney)
  // in the order they appear: a title never repeats until the whole list has been used
  const TITLES = [
    'Miss Verdict', 'Counselor', 'Ms. Objection', 'Your Honour',
    'Ms. Attorney', 'Madam Advocate', 'Madam Counsel', 'Ms. Case Closed', 'Lady Justice',
  ];
  const titleOrder = TITLES.map((_, i) => i);
  const NAME = 'Chaithanya';
  const nameWord = (location.search.includes('debug') && new URLSearchParams(location.search).get('name'))
    || (visit % 2 === 0 ? NAME : TITLES[titleOrder[Math.floor(visit / 2) % TITLES.length]]);
  const greeting = (location.search.includes('debug') && new URLSearchParams(location.search).get('greet')) || greetingFor(new Date(), visit);

  // The song for a mood advances once per visit, the first time that mood is chosen.
  const chosenThisVisit = {};
  function songFor(mood, list) {
    if (!list || !list.length) return null;
    if (!(mood in chosenThisVisit)) {
      const n = store.get('song2:' + mood, 0);
      chosenThisVisit[mood] = n % list.length;
      store.set('song2:' + mood, n + 1);
    }
    return list[chosenThisVisit[mood]];
  }

  // ---------- greeting: her name resolves out of the same glyphs the video is made of ----------

  const GLYPHS = '@&$%QO8#/\\|{}()[]<>*+=~;:,.-_';
  function buildGlyphs(el, text) {
    el.textContent = '';
    const spans = [];
    for (const c of text) {
      if (c === ' ') { el.append(' '); continue; }
      const ch = document.createElement('span'); ch.className = 'ch';
      const real = document.createElement('span'); real.className = 'real'; real.textContent = c;
      const gl = document.createElement('span'); gl.className = 'gl'; gl.textContent = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      ch.append(real, gl); el.append(ch);
      spans.push({ ch, gl });
    }
    return spans;
  }
  function resolveGlyphs(spans, wait = 250, step = 85) {
    if (reduceMotion) { spans.forEach((s) => s.ch.classList.add('is-done')); return; }
    const start = performance.now() + wait;
    spans.forEach((s, i) => {
      const doneAt = start + 380 + i * step;
      const tick = () => {
        const now = performance.now();
        if (now >= doneAt) { s.ch.classList.add('is-done'); return; }
        if (now >= start) s.gl.textContent = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
        setTimeout(tick, 55);
      };
      tick();
    });
  }

  // ---------- audio ----------
  // Each snippet is ~10 s. It loops, fading out at its end and back in very slightly at its start.

  // Opened as a file, browsers refuse to fetch() the clips. prepare.py also writes each clip as audio/<name>.m4a.js
  // (a data: URI), which a <script> tag is allowed to load. Hosted copies never use these.
  function clipFromScript(url) {
    const have = window.__clips && window.__clips[url];
    if (have) return Promise.resolve(have);
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = url + '.js';
      s.onload = () => (window.__clips && window.__clips[url] ? resolve(window.__clips[url]) : reject(new Error('clip data missing')));
      s.onerror = () => reject(new Error('clip script missing'));
      document.head.append(s);
    });
  }

  const FADE_IN = 0.2, FADE_OUT = 1.2, SWITCH_OUT = 0.5, LOOKAHEAD = 2;
  const audio = {
    ctx: null, master: null, buffers: new Map(), voices: new Set(), current: null, buf: null, timer: 0, token: 0, on: true,

    init() {
      if (this.ctx) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* older iOS */ }
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
    },

    load(url) {
      if (!this.buffers.has(url)) {
        const bytes = location.protocol === 'file:' ? clipFromScript(url).then((d) => fetch(d)) : fetch(url);
        const p = bytes.then((r) => { if (!r.ok) throw new Error(url); return r.arrayBuffer(); })
          .then((b) => new Promise((res, rej) => this.ctx.decodeAudioData(b, res, rej)));
        p.catch(() => this.buffers.delete(url));
        this.buffers.set(url, p);
      }
      return this.buffers.get(url);
    },

    voice(buf, when) {
      const c = this.ctx, src = c.createBufferSource(), g = c.createGain();
      const end = when + buf.duration;
      src.buffer = buf;
      g.gain.setValueAtTime(0, when);
      g.gain.linearRampToValueAtTime(1, when + FADE_IN);
      g.gain.setValueAtTime(1, Math.max(when + FADE_IN, end - FADE_OUT));
      g.gain.linearRampToValueAtTime(0, end);
      src.connect(g).connect(this.master);
      src.start(when);
      const v = { src, g, when, end };
      src.onended = () => { this.voices.delete(v); g.disconnect(); };
      this.voices.add(v);
      this.current = v;
      return v;
    },

    fadeAll(seconds) {
      const now = this.ctx.currentTime;
      for (const v of this.voices) {
        const p = v.g.gain;
        p.cancelScheduledValues(now);
        p.setValueAtTime(v.when > now ? 0 : Math.max(0, p.value), now);
        p.linearRampToValueAtTime(0, now + seconds);
        try { v.src.stop(now + seconds + 0.05); } catch { /* already stopped */ }
      }
    },

    async play(url, delay = 0) {
      if (!this.ctx) return;
      const token = ++this.token;
      try { await this.ctx.resume(); } catch { /* needs a gesture; the mood tap is one */ }
      let buf;
      try { buf = await this.load(url); } catch { return; }
      if (token !== this.token) return;
      const switching = this.voices.size > 0;
      if (switching) this.fadeAll(SWITCH_OUT);
      this.buf = buf;
      this.voice(buf, this.ctx.currentTime + delay + (switching ? SWITCH_OUT * 0.85 : 0.05));
      clearInterval(this.timer);
      this.timer = setInterval(() => {
        const v = this.current;
        if (v && this.buf && this.ctx.currentTime > v.end - LOOKAHEAD) this.voice(this.buf, v.end);   // seamless loop of the same snippet
      }, 250);
    },

    // stop everything and release the audio device: used when the page is closed, reloaded or sent to the background for good
    close() {
      clearInterval(this.timer); this.token += 1;
      const c = this.ctx;
      if (!c) return;
      this.ctx = null; this.master = null; this.current = null; this.buf = null;
      for (const v of this.voices) { try { v.src.stop(); } catch { /* already stopped */ } }
      this.voices.clear(); this.buffers.clear();
      c.close().catch(() => {});
    },

    setOn(on) {
      this.on = on;
      if (this.master) this.master.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.08);
    },
  };

  // ---------- the page ----------

  const video = $('#video');
  let songs = null;
  let started = false;
  let currentMood = null;

  // songs.js (loaded by the page) holds the song list; fall back to songs.json if it is missing
  const songsReady = Promise.resolve(window.__songs || fetch('songs.json').then((r) => r.json())).then((j) => { songs = j; }).catch(() => { songs = {}; });

  // Warm-up while she is reading the greeting: open the audio engine (silent) and decode the song each mood will play
  // next, so tapping a mood only has to start playback.
  const idle = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 120));
  async function prewarm() {
    await songsReady;
    audio.init();
    for (const m of Object.keys(MOODS)) {
      const list = songs[m];
      if (!list || !list.length) continue;
      const next = list[store.get('song2:' + m, 0) % list.length];
      try { await audio.load(next.file); } catch { /* it will be fetched on demand instead */ }
      await new Promise((r) => idle(r));
    }
  }

  function setMood(mood) {
    currentMood = mood;
    document.documentElement.style.setProperty('--accent', MOODS[mood].accent);
    document.documentElement.style.setProperty('--ctl', MOODS[mood].ctl);
  }

  async function playMood(mood, delay) {
    await songsReady;
    const song = songFor(mood, songs[mood]);
    count('mood-' + mood);
    if (song) { count('song-' + song.file.replace(/^audio\//, '').replace(/\.m4a$/, '')); audio.play(song.file, delay); }
  }

  // the next song in this mood's order; the saved counter moves on too, so the next visit carries on after it
  async function nextSong() {
    if (!started || !currentMood) return;
    await songsReady;
    const list = songs[currentMood];
    if (!list || list.length < 2) return;
    const i = ((chosenThisVisit[currentMood] ?? 0) + 1) % list.length;
    chosenThisVisit[currentMood] = i;
    store.set('song2:' + currentMood, i + 1);
    count('skips');
    count('song-' + list[i].file.replace(/^audio\//, '').replace(/\.m4a$/, ''));
    audio.play(list[i].file, 0);
    idle(() => audio.load(list[(i + 1) % list.length].file).catch(() => {}));         // warm the one after this
  }

  function pick(mood, button) {
    if (started || install.open) return;
    started = true;
    audio.init();                                   // created inside the tap, so phones allow sound
    if (audio.ctx) audio.ctx.resume().catch(() => {});
    setMood(mood);
    button.classList.add('is-picked');
    body.classList.add('is-opening');
    video.play().catch(() => {});
    glow.pause();                                   // the wandering light holds still while the lid lifts
    playMood(mood, reduceMotion ? 0.1 : 0.55);      // music joins as the lid is lifting
    setTimeout(() => {
      body.classList.add('is-open');
      $('#now').inert = false;
      $('#intro').inert = true;
      glow.stop();
    }, reduceMotion ? 450 : 1650);
  }

  // ---------- home screen: slow blurry light that drifts, and leans toward a finger or cursor ----------

  const glow = (() => {
    const cv = $('#glow');
    const c = cv.getContext('2d', { alpha: false });
    const GROUND = [11, 7, 8];
    const GAIN = 0.3;                                   // how bright the lights get; the page should stay mostly dark and quiet
    // warm lights, each on its own slow loop (periods of roughly 25-70 s)
    const blobs = [
      { c: [232, 119, 106], r: 0.62, a: 0.40, x: 0.28, y: 0.30, ax: 0.22, ay: 0.16, fx: 0.020, fy: 0.014, px: 0.0, py: 1.1 },
      { c: [242, 198, 189], r: 0.46, a: 0.22, x: 0.72, y: 0.20, ax: 0.20, ay: 0.14, fx: 0.013, fy: 0.021, px: 2.0, py: 0.3 },
      { c: [247, 182, 133], r: 0.50, a: 0.26, x: 0.60, y: 0.62, ax: 0.26, ay: 0.20, fx: 0.016, fy: 0.012, px: 4.1, py: 2.2 },
      { c: [184, 69, 63],   r: 0.70, a: 0.46, x: 0.25, y: 0.78, ax: 0.20, ay: 0.14, fx: 0.011, fy: 0.018, px: 1.3, py: 5.0 },
      { c: [255, 116, 97],  r: 0.40, a: 0.20, x: 0.85, y: 0.82, ax: 0.14, ay: 0.18, fx: 0.019, fy: 0.015, px: 3.3, py: 0.9 },
    ].map((b) => ({ ...b, ox: 0, oy: 0, pulse: 0 }));
    const ptr = { x: 0.5, y: 0.4, tx: 0.5, ty: 0.4, power: 0, target: 0, pulse: 0, moved: 0 };
    let W = 0, H = 0, raf = 0, running = false, t0 = 0;

    function resize() {
      const w = Math.max(1, innerWidth), h = Math.max(1, innerHeight);
      W = 120; H = Math.max(60, Math.round(120 * h / w));
      cv.width = W; cv.height = H;
    }

    function frame(now) {
      if (!running) return;
      const t = (now - t0) / 1000;
      const k = Math.max(W, H);
      c.globalCompositeOperation = 'source-over';
      c.fillStyle = `rgb(${GROUND})`;
      c.fillRect(0, 0, W, H);
      c.globalCompositeOperation = 'lighter';

      if (now - ptr.moved > 1800) {
        // nobody is touching: a light wanders on its own, so the screen is always slowly alive
        ptr.tx = 0.5 + 0.34 * Math.sin(t * 0.13 + 0.6) + 0.1 * Math.sin(t * 0.31);
        ptr.ty = 0.46 + 0.32 * Math.sin(t * 0.09 + 2.1) + 0.08 * Math.sin(t * 0.27);
        ptr.target = 0.7;
      }
      ptr.power += (ptr.target - ptr.power) * 0.04;
      ptr.x += (ptr.tx - ptr.x) * 0.075;
      ptr.y += (ptr.ty - ptr.y) * 0.075;
      ptr.pulse *= 0.955;

      for (const b of blobs) {
        const bx = b.x + b.ax * Math.sin(t * b.fx * 6.2832 + b.px);
        const by = b.y + b.ay * Math.sin(t * b.fy * 6.2832 + b.py);
        // lean toward the pointer, more when it is close; ease back when it leaves
        const dx = ptr.x - bx, dy = ptr.y - by;
        const near = Math.exp(-Math.hypot(dx, dy) * 2.4);
        b.ox += (dx * 0.34 * near * ptr.power - b.ox) * 0.035;
        b.oy += (dy * 0.34 * near * ptr.power - b.oy) * 0.035;
        b.pulse *= 0.96;
        draw(b.c, (bx + b.ox) * W, (by + b.oy) * H, b.r * k * (1 + 0.28 * b.pulse + 0.1 * ptr.pulse), b.a * GAIN * (1 + 0.5 * b.pulse));
      }
      // a soft warm light that follows the finger or cursor
      if (ptr.power > 0.01 || ptr.pulse > 0.01) {
        draw([255, 205, 180], ptr.x * W, ptr.y * H, (0.34 + 0.16 * ptr.pulse) * k, 0.27 * Math.max(ptr.power, ptr.pulse));
      }
      raf = requestAnimationFrame(frame);
    }

    function draw(col, x, y, r, a) {
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      const s = col.join(',');
      g.addColorStop(0, `rgba(${s},${a})`);
      g.addColorStop(0.4, `rgba(${s},${a * 0.5})`);
      g.addColorStop(0.75, `rgba(${s},${a * 0.12})`);
      g.addColorStop(1, `rgba(${s},0)`);
      c.fillStyle = g;
      c.fillRect(0, 0, W, H);
    }

    function aim(e) {
      ptr.tx = e.clientX / Math.max(1, innerWidth);
      ptr.ty = e.clientY / Math.max(1, innerHeight);
      ptr.target = 1; ptr.moved = performance.now();
    }

    return {
      start() {
        resize();
        if (reduceMotion) { running = true; t0 = performance.now() - 14000; frame(performance.now()); running = false; return; }   // one still frame
        running = true; t0 = performance.now(); raf = requestAnimationFrame(frame);
        addEventListener('resize', resize);
        addEventListener('pointermove', aim, { passive: true });
        addEventListener('pointerdown', (e) => {
          aim(e);
          ptr.x = ptr.tx; ptr.y = ptr.ty;                                   // a touch lands right where the finger is
          ptr.pulse = 1; blobs.forEach((b) => { b.pulse = Math.max(b.pulse, 0.7); });
        }, { passive: true });
        
      },
      stop() { running = false; cancelAnimationFrame(raf); },
      pause() { running = false; cancelAnimationFrame(raf); },
      resume() { if (!running && !body.classList.contains('is-open') && !reduceMotion) { running = true; raf = requestAnimationFrame(frame); } },
    };
  })();

  // film grain: one small noise tile, generated here so there is nothing extra to download
  (() => {
    const n = document.createElement('canvas'); n.width = n.height = 160;
    const g = n.getContext('2d'), im = g.createImageData(160, 160);
    for (let i = 0; i < im.data.length; i += 4) { const v = Math.random() < 0.5 ? 0 : 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = Math.random() * 120; }   // plain alpha speckle: no blend mode to compute
    g.putImageData(im, 0, 0);
    $('.grain').style.backgroundImage = `url(${n.toDataURL('image/png')})`;
  })();

  // ---------- "keep this one close": install sheet ----------

  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const params = new URLSearchParams(location.search);
  const debugInstall = params.has('debug') ? params.get('install') : null;      // ?debug&install=ios|menu|prompt to preview
  const SHARE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M8 7l4-4 4 4M6 11H5.5A1.5 1.5 0 0 0 4 12.5v6A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5v-6a1.5 1.5 0 0 0-1.5-1.5H18"/></svg>';
  const install = { deferred: null, mode: null, open: false };
  const sheetWrap = $('#install'), sheet = $('#sheet'), goBtn = $('#installGo'), laterBtn = $('#installLater');

  function platform() {
    const ua = navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    return { ios, android: /Android/.test(ua) };
  }

  function setMode(mode) {
    install.mode = mode;
    const body = $('#installBody');
    const touch = matchMedia('(pointer: coarse)').matches;
    if (mode === 'prompt' && !touch) { body.textContent = ''; goBtn.textContent = 'Install app'; }
    else if (mode === 'prompt') { body.textContent = 'Add it to your home screen and it opens like an app, any time you want it.'; goBtn.textContent = 'Add to home screen'; }
    else if (mode === 'ios') { body.innerHTML = `Tap ${SHARE_ICON} <em>Share</em> in Safari, then choose <em>Add to Home Screen</em>.`; goBtn.textContent = 'Got it'; }
    else { body.textContent = 'Open your browser’s menu and choose “Add to Home screen”.'; goBtn.textContent = 'Got it'; }
  }

  function openSheet(mode) {
    if (install.open || started) return;
    install.open = true;
    setMode(mode);
    sheetWrap.setAttribute('aria-hidden', 'false');
    $('#intro').inert = true;
    requestAnimationFrame(() => { sheetWrap.classList.add('is-open'); setTimeout(() => goBtn.focus({ preventScroll: true }), 120); });
  }

  function closeSheet(later) {
    if (!install.open) return;
    install.open = false;
    dismissedThisLoad = true;
    sheetWrap.classList.remove('is-open');
    sheetWrap.setAttribute('aria-hidden', 'true');
    sheet.style.removeProperty('--drag');
    if (!started) $('#intro').inert = false;
  }

  let dismissedThisLoad = false;                                       // "Not now" lasts until the next open or reload, then it asks again
  function maybeInstall() {
    if (started || install.open || dismissedThisLoad) return;
    if (location.search.includes('debug') && params.has('noinstall')) return;
    if (debugInstall) { openSheet(debugInstall); return; }
    if (standalone) return;                                          // already installed and opened as an app
    if (store.get('installed', false) && !install.deferred) return;  // installed earlier and the browser agrees (it offers no prompt)
    const p = platform();
    if (install.deferred) openSheet('prompt');
    else if (p.ios) openSheet('ios');
    else if (p.android) openSheet('menu');
    // desktop browsers without an install event (Firefox, Safari): nothing to offer
  }

  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    install.deferred = e;
    if (install.open) setMode('prompt');                       // the sheet was already up with instructions: upgrade it
    else if (readyForInstall) maybeInstall();
  });
  addEventListener('appinstalled', () => { store.set('installed', true); count('installed'); closeSheet(false); });

  goBtn.addEventListener('click', async () => {
    if (install.mode === 'prompt' && install.deferred) {
      const ev = install.deferred; install.deferred = null;
      closeSheet(false);
      try { await ev.prompt(); const r = await ev.userChoice; if (r.outcome === 'accepted') store.set('installed', true); } catch { /* user dismissed */ }
    } else closeSheet(true);
  });
  laterBtn.addEventListener('click', () => closeSheet(true));
  $('#installBackdrop').addEventListener('click', () => closeSheet(true));
  addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(true); });

  // drag the sheet down to dismiss: a quick flick is enough, no need to go far
  (() => {
    let y0 = 0, dy = 0, t0 = 0, drag = false;
    sheet.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) return; drag = true; y0 = e.clientY; dy = 0; t0 = performance.now(); sheet.classList.add('is-dragging'); sheet.setPointerCapture(e.pointerId); });
    sheet.addEventListener('pointermove', (e) => {
      if (!drag) return;
      dy = e.clientY - y0;
      const eased = dy > 0 ? dy : dy * 0.15;                                 // friction instead of a hard stop going up
      sheet.style.setProperty('--drag', `${eased}px`);
    });
    const end = () => {
      if (!drag) return; drag = false; sheet.classList.remove('is-dragging');
      const v = dy / Math.max(1, performance.now() - t0);
      if (dy > 90 || v > 0.5) closeSheet(true); else sheet.style.setProperty('--drag', '0px');
    };
    sheet.addEventListener('pointerup', end); sheet.addEventListener('pointercancel', end);
  })();

  let readyForInstall = false;

  // ---------- wiring ----------

  $$('.mood').forEach((b) => b.addEventListener('click', () => pick(b.dataset.mood, b)));
  $('#skip').addEventListener('click', nextSong);

  // "back" starts over: the sound fades out, then the page reloads to the greeting with a fresh quote and song
  $('#back').addEventListener('click', () => {
    if (audio.ctx) audio.fadeAll(0.25);
    setTimeout(() => location.reload(), reduceMotion ? 0 : 260);
  });
  $('#sound').addEventListener('click', (e) => {
    const on = !audio.on;
    audio.setOn(on);
    e.currentTarget.setAttribute('aria-pressed', String(!on));
    e.currentTarget.setAttribute('aria-label', on ? 'Sound on' : 'Sound off');
  });

  function shutDown() {
    audio.close();
    video.pause();
    glow.pause();
  }
  addEventListener('pagehide', shutDown);
  addEventListener('freeze', shutDown);
  addEventListener('pageshow', (e) => { if (e.persisted) location.reload(); });      // restored from the back/forward cache: start clean

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      glow.pause();
      video.pause();
      if (audio.ctx && started) audio.ctx.suspend().catch(() => {});
      store.set('hiddenAt', Date.now());
    } else {
      // away for a long while counts as a new visit: reload so the quote and song move on
      if (Date.now() - store.get('hiddenAt', Date.now()) > 20 * 60 * 1000) { sessionStorage.removeItem('cg:counted'); location.reload(); return; }
      glow.resume();
      if (started) { video.play().catch(() => {}); if (audio.ctx) audio.ctx.resume().catch(() => {}); }
    }
  });

  // keep decoding cheap until the lid opens, but have the first frames ready

  // entrance, once the type has loaded (with a safety timeout so nothing stays hidden)
  glow.start();
  const hiEl = $('.hi');
  hiEl.classList.toggle('is-long', greeting.length > 3);
  const hiSpans = buildGlyphs(hiEl, greeting);
  const nameSpans = buildGlyphs($('#name'), nameWord);
  $('.greeting').setAttribute('aria-label', `${greeting} ${nameWord}`);
  document.title = 'Twieyes';

  // a longer title must still fit on one line: shrink it to the width the screen allows, never grow it
  function fitName() {
    const el = $('#name'), box = $('#intro');
    el.style.fontSize = '';
    const cs = getComputedStyle(box);
    const pl = parseFloat(cs.paddingLeft), pr = parseFloat(cs.paddingRight);
    let avail = box.clientWidth - pl - pr;
    el.style.width = 'max-content';
    const r = el.getBoundingClientRect();
    el.style.width = '';
    // on a PC the mood list sits bottom-right: if the title would run down into its rows, stop short of it
    const mood = $('.intro-bottom').getBoundingClientRect();
    if (getComputedStyle($('.intro-bottom')).position === 'absolute' && r.bottom + 24 > mood.top) avail = Math.min(avail, mood.left - box.getBoundingClientRect().left - pl - 40);
    if (r.width > avail && avail > 0) el.style.fontSize = (parseFloat(getComputedStyle(el).fontSize) * (avail / r.width) * 0.97).toFixed(2) + 'px';
  }
  fitName();
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(fitName);
  let fitTimer = 0; addEventListener('resize', () => { clearTimeout(fitTimer); fitTimer = setTimeout(fitName, 120); });
  const go = () => {
    $('#poster').classList.add('is-in');
    if (matchMedia('(min-aspect-ratio: 1 / 1)').matches) {                                    // PCs: load the landscape portrait only when it will be shown
      const pw = $('#posterWide');
      pw.addEventListener('load', () => pw.classList.add('is-in'), { once: true });
      pw.src = 'assets/poster-wide.jpg';
    }
    body.classList.add('is-ready');
    resolveGlyphs(hiSpans, 250, 70);                                   // the greeting resolves first...
    resolveGlyphs(nameSpans, 250 + hiSpans.length * 55, 85);           // ...then her name
    setTimeout(() => { readyForInstall = true; maybeInstall(); }, reduceMotion ? 600 : 1500);   // as soon as the greeting has settled
    setTimeout(() => idle(prewarm), 2800);                                                      // after the entrance, never during it
  };
  let went = false;
  const once = () => { if (!went) { went = true; go(); } };
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(() => requestAnimationFrame(once));
  setTimeout(once, 1500);

  if (location.search.includes('debug')) window.__cg = { audio, store, QUOTES, chosenThisVisit, install };

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
