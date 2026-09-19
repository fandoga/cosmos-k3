/* ==========================================================================
   COSMOS · 65 лет спустя
   One continuous scene. A single scrubbed GSAP timeline drives one state object `S`;
   a single ticker render() maps that state onto every layer (stars, Earth, orbit,
   watch, film). Nothing animates on its own island, so the whole journey reads as
   one camera move: 65 → Earth → orbit → 108 → light ring → watch → macro.
   ========================================================================== */
(function () {
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TAU = Math.PI * 2;

  // ---- measured source geometry --------------------------------------------------------
  const EARTH = { cx: 1224, cy: 744, r: 576 };                 // planet in the 2560×1440 loop
  const WATCH = { w: 970, h: 1621, cx: 460, cy: 748, r: 375 };  // dial in K3_Б-high_res.png
  const FILM = { w: 1600, h: 900, cx: 0.514, cy: 0.522, r: 0.41 }; // dial in seq-dial/000

  // ---- elements --------------------------------------------------------------------------
  const stage = $('.stage');
  const earthEl = $('.earth');
  const video = $('.earth__video');
  const limbEl = $('.limb');
  const watchEl = $('.watch');
  const wRim = $('.w--rim');
  const wDial = $('.w--dial');
  const wLit = $('.w--lit');
  const wSweep = $('.w--sweep');
  const filmEl = $('.film');
  const vignette = $('.film-vignette');
  const hud = $('.hud');
  const rail = $('.hud__rail span');
  const cue = $('.hud__cue');
  const clockLabel = $('.hud__clock-label');
  const clockValue = $('.hud__clock-value');
  const coordA = $('.hud__coord-a');
  const coordB = $('.hud__coord-b');

  const stars = Starfield($('.stars'));
  const orbit = Orbit($('.orbit'));
  const film = Film(filmEl);
  const seqDial = Sequence('media/seq-dial', 70);
  const seqMacro = Sequence('media/seq-macro', 105);

  // ---- scene state (the only thing the timeline touches, besides typography) ------------
  const S = {
    intro: 0,
    camX: 0, camY: 0, camZ: 0, roll: -5, starA: 0,
    earthK: 0, earthA: 1, earthRoll: -7,
    orbA: 0, orbDraw: 0, dot: 0, dotA: 0, trail: 0.42, glow: 0,
    orbFree: 0, tilt: 76, push: 0, orbShrink: 0,
    wA: 0, wSil: 0, wDial: 0, wLit: 0, wSweep: -0.4, wZoom: 0, float: 0,
    limbA: 0, limbK: 0,
    seqA: 0, dialF: 0, macroMix: 0, macroF: 0, seqZoom: 0,
  };

  // ---- layout ----------------------------------------------------------------------------
  let W = 0, H = 0, DPR = 1, portrait = false;
  const L = {};

  function layout() {
    W = stage.clientWidth;
    H = stage.clientHeight;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    portrait = W / H < 0.9;

    // Earth keyframes: 0 = "65" (huge, below the frame), 1 = orbit composition, 2 = camera passes over it
    L.earth = portrait
      ? [
          { x: 0.64 * W, y: 0.96 * H, r: 0.74 * W },
          { x: 0.52 * W, y: 0.63 * H, r: 0.33 * W },
          { x: 0.5 * W, y: 1.6 * H, r: 1.15 * W },
        ]
      : [
          { x: 0.77 * W, y: 1.2 * H, r: 0.84 * H },
          { x: 0.655 * W, y: 0.53 * H, r: 0.27 * H },
          { x: 0.58 * W, y: 1.62 * H, r: 0.95 * H },
        ];

    L.orbitScale = portrait ? 1.62 : 1.78;          // orbit radius relative to the planet
    L.dialR = Math.min(0.17 * H, 0.31 * W);          // watch dial radius at the match-cut
    L.ringR = L.dialR * 1.035;                       // light ring lands on the bezel edge
    L.swellR = portrait ? 0.62 * W : 0.46 * H;

    // film cover-fit → where the filmed dial sits on screen
    const cs = Math.max(W / FILM.w, H / FILM.h);
    L.filmDialR = FILM.r * FILM.h * cs;
    L.filmDX = (FILM.cx - 0.5) * FILM.w * cs;
    L.filmDY = (FILM.cy - 0.5) * FILM.h * cs;
    L.zoomMax = L.filmDialR / L.dialR;

    // The watch box is laid out at its LARGEST on-screen size and only ever scaled down,
    // so the PNG is rasterised at full resolution instead of an upscaled small bitmap.
    L.ws = (L.dialR * L.zoomMax) / WATCH.r;
    watchEl.style.width = WATCH.w * L.ws + 'px';
    watchEl.style.height = WATCH.h * L.ws + 'px';
    watchEl.style.transformOrigin = WATCH.cx * L.ws + 'px ' + WATCH.cy * L.ws + 'px';

    L.limbS = Math.max(W * 1.14, H * 0.95) / 1200;

    stars.resize(W, H, DPR);
    orbit.resize(W, H, DPR);
    film.resize(W, H, DPR);
  }

  // ---- helpers ---------------------------------------------------------------------------
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  function keys(arr, k) {
    const i = Math.min(arr.length - 2, Math.max(0, Math.floor(k)));
    const t = clamp01(k - i);
    const a = arr[i], b = arr[i + 1];
    return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), r: lerp(a.r, b.r, t) };
  }
  const pad = (n) => String(n).padStart(2, '0');
  function tplus(minutes) {
    const s = Math.round(minutes * 60);
    return pad(Math.floor(s / 3600)) + ':' + pad(Math.floor((s % 3600) / 60)) + ':' + pad(s % 60);
  }
  let lastText = {};
  function setText(el, key, value) {
    if (lastText[key] === value) return;
    lastText[key] = value;
    el.textContent = value;
  }

  // ---- HUD phases ------------------------------------------------------------------------
  const PHASES = [
    { at: 0, a: '45°55′N 63°20′E', b: 'Baikonur · 06:07 UTC' },
    { at: 0.24, a: 'Vostok-1 · 1 orbit', b: 'Incl 64.95° · 108 min' },
    { at: 0.56, a: 'Cosmos K3', b: 'Made in Russia' },
  ];
  let phase = 0;
  function updatePhase(p) {
    let next = 0;
    for (let i = 0; i < PHASES.length; i++) if (p >= PHASES[i].at) next = i;
    if (next === phase) return;
    phase = next;
    gsap.to([coordA, coordB], {
      autoAlpha: 0, y: -6, duration: 0.25, ease: 'power2.in', overwrite: true,
      onComplete() {
        coordA.textContent = PHASES[phase].a;
        coordB.textContent = PHASES[phase].b;
        gsap.fromTo([coordA, coordB], { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: 0, duration: 0.5, stagger: 0.06, ease: 'power3.out' });
      },
    });
  }

  // ---- render ----------------------------------------------------------------------------
  let progress = 0;
  let videoPlaying = true;

  function render() {
    const t = performance.now() / 1000;

    // Earth
    const e = keys(L.earth, S.earthK);
    const er = e.r * (1 + 0.06 * (1 - S.intro));
    const ek = er / EARTH.r;
    const earthOpacity = S.earthA * S.intro;

    // stars — the camera (the planet hides whatever is behind it)
    stars.render(S, t, reduce, earthOpacity > 0.3 ? { x: e.x, y: e.y, r: er * 1.02 } : null);
    earthEl.style.transform =
      'translate3d(' + (e.x - EARTH.cx).toFixed(1) + 'px,' + (e.y - EARTH.cy).toFixed(1) + 'px,0) scale(' + ek.toFixed(4) + ') rotate(' + S.earthRoll.toFixed(2) + 'deg)';
    earthEl.style.opacity = earthOpacity.toFixed(3);
    if (earthOpacity < 0.005 && videoPlaying) { video.pause(); videoPlaying = false; }
    else if (earthOpacity >= 0.005 && !videoPlaying) { video.play().catch(() => {}); videoPlaying = true; }

    // orbit — attached to the planet, then released toward the camera
    const attachedR = e.r * L.orbitScale;
    const freeR = lerp(L.swellR, L.ringR, S.orbShrink);
    orbit.render({
      cx: lerp(e.x, W / 2, S.orbFree),
      cy: lerp(e.y, H / 2, S.orbFree),
      R: lerp(attachedR, freeR, S.orbFree),
      tilt: S.tilt,
      roll: lerp(-15, 0, S.orbFree) + S.earthRoll * 0.4,
      push: S.push * H,
      start: 2.35,
      draw: S.orbDraw,
      dot: S.dot,
      dotA: S.dotA,
      trail: S.trail,
      glow: S.glow,
      alpha: S.orbA,
      earth: { x: e.x, y: e.y, r: er, a: earthOpacity },
    });

    // Earth limb behind the floating watch
    if (S.limbA > 0.002) {
      const ls = L.limbS * (1 + 0.1 * S.limbK);
      const lw = 1200 * ls;
      const ly = lerp(1.32, 0.8, S.limbK) * H - 0.66 * 2608 * ls;
      limbEl.style.transform = 'translate3d(' + ((W - lw) / 2).toFixed(1) + 'px,' + ly.toFixed(1) + 'px,0) scale(' + ls.toFixed(4) + ')';
    }
    limbEl.style.opacity = S.limbA.toFixed(3);

    // watch
    if (S.wA > 0.002) {
      const f = reduce ? 0 : S.float;
      const fx = Math.sin(t * 0.31) * W * 0.004 * f;
      const fy = Math.sin(t * 0.47) * H * 0.01 * f;
      const rx = Math.sin(t * 0.29) * 2.4 * f;
      const ry = Math.sin(t * 0.21 + 1.3) * 3.6 * f;
      const rz = Math.sin(t * 0.17 + 0.4) * 1.2 * f;
      const z = S.wZoom;
      const sc = lerp(1, L.zoomMax, z) / L.zoomMax;
      const tx = W / 2 - WATCH.cx * L.ws + fx + L.filmDX * z;
      const ty = H / 2 - WATCH.cy * L.ws + fy + L.filmDY * z;
      watchEl.style.transform =
        'translate3d(' + tx.toFixed(1) + 'px,' + ty.toFixed(1) + 'px,0) perspective(1400px) rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg) rotateZ(' + rz.toFixed(2) + 'deg) scale(' + sc.toFixed(4) + ')';
      wRim.style.opacity = (S.wSil * 0.6 * (1 - S.wLit * 0.7)).toFixed(3);
      wDial.style.setProperty('--dr', (S.wDial * 1.42 * WATCH.r * L.ws).toFixed(1) + 'px');
      wLit.style.opacity = S.wLit.toFixed(3);
      wSweep.style.setProperty('--s', (S.wSweep * 100).toFixed(1) + '%');
    }
    watchEl.style.opacity = S.wA.toFixed(3);

    // film
    if (S.seqA > 0.002) {
      film.render(seqDial.get(S.dialF), seqMacro.get(S.macroF), S.macroMix, 1 + 0.07 * S.seqZoom, 0, 0);
    }
    filmEl.style.opacity = S.seqA.toFixed(3);
    vignette.style.opacity = S.seqA.toFixed(3);

    // HUD
    rail.style.transform = 'scaleY(' + progress.toFixed(4) + ')';
    cue.style.opacity = (1 - clamp01(progress * 30)).toFixed(3);
    if (progress < 0.56) {
      setText(clockLabel, 'l', 'T+');
      setText(clockValue, 'v', tplus(clamp01(S.dot - 1) * 108));
    } else {
      setText(clockLabel, 'l', 'UTC');
      setText(clockValue, 'v', '12.04.2026 06:07');
    }
    updatePhase(progress);
  }

  // ---- master scroll timeline ------------------------------------------------------------
  function buildTimeline() {
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: '.journey',
        start: 'top top',
        end: () => '+=' + Math.round(window.innerHeight * 10.5),
        pin: true,
        scrub: reduce ? true : 1.15,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => { progress = self.progress; },
      },
    });

    const d65 = $$('.title--65 .digit');
    const d108 = $$('.title--108 .digit');

    // ── Scene 2 · the camera starts to move (2 → 26)
    tl.to(S, { camX: 0.16, camY: -0.05, camZ: 0.22, roll: 0, duration: 28, ease: 'sine.inOut' }, 0)
      .to(S, { earthK: 1, duration: 24, ease: 'power2.inOut' }, 3)
      .to(S, { earthRoll: 0, duration: 24, ease: 'sine.inOut' }, 3)
      .to('.title--65 .big', { scale: 1.32, xPercent: -5, yPercent: -3, transformOrigin: '0% 60%', duration: 14, ease: 'power2.in' }, 2)
      .to(d65[0], { xPercent: -14, duration: 14, ease: 'power2.in' }, 2)
      .to(d65[1], { xPercent: 10, duration: 14, ease: 'power2.in' }, 2)
      .to('.title--65 .title__info', { autoAlpha: 0, y: -24, duration: 6, ease: 'power1.in' }, 2)
      .to('.title--65 .big', { autoAlpha: 0, duration: 8, ease: 'power1.in' }, 8.5)
      // the orbit is drawn around the planet, the craft at its head
      .to(S, { orbA: 1, dotA: 1, duration: 3 }, 12)
      .to(S, { orbDraw: 1, dot: 1, duration: 16, ease: 'power1.inOut' }, 12);

    // ── Scene 3 · 108 minutes (25 → 45)
    tl.set('.title--108', { autoAlpha: 1 }, 24.9)
      .fromTo(d108, { yPercent: 108 }, { yPercent: 0, duration: 7, stagger: 1.1, ease: 'power3.out' }, 25)
      .fromTo('.title--108 .title__meta > *', { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 4, stagger: 1.4, ease: 'power2.out' }, 31)
      .to('.title--108 .big', { xPercent: 3, duration: 20 }, 27)
      .to(S, { dot: 2, duration: 16 }, 29)                         // one orbit = the mission clock runs to 108 min
      .to(S, { camX: 0.3, camZ: 0.36, duration: 18, ease: 'sine.inOut' }, 28)
      .to(S, { earthRoll: 4, duration: 18, ease: 'sine.inOut' }, 28);

    // ── Scene 4 · the orbit swings toward the camera and becomes the dial (45 → 63)
    tl.to('.title--108 .big', { scale: 1.28, xPercent: -6, autoAlpha: 0, transformOrigin: '0% 50%', duration: 8, ease: 'power2.in' }, 45)
      .to('.title--108 .title__meta', { autoAlpha: 0, y: -16, duration: 4, ease: 'power1.in' }, 45)
      .to(S, { earthK: 2, duration: 12, ease: 'power2.in' }, 46)
      .to(S, { earthA: 0, duration: 4.5 }, 49.5)
      .to(S, { orbFree: 1, tilt: 0, duration: 9, ease: 'power2.inOut' }, 46)
      .to(S, { push: 0.75, duration: 5.5, ease: 'power2.out' }, 46.5)
      .to(S, { push: 0, duration: 6.5, ease: 'power2.inOut' }, 52.5)
      .to(S, { orbShrink: 1, duration: 7.5, ease: 'power3.inOut' }, 52.5)
      .to(S, { trail: TAU + 0.01, glow: 1, duration: 6, ease: 'power1.inOut' }, 47)
      .to(S, { dot: 2.9, duration: 14 }, 46)
      .to(S, { dotA: 0, duration: 3 }, 57)
      .to(S, { camX: 0.08, camY: 0, camZ: 0.78, duration: 16, ease: 'power2.inOut' }, 46)
      // the watch condenses inside the ring: silhouette → dial → reflections → steel
      .to(S, { wA: 1, duration: 0.5 }, 54)
      .to(S, { wSil: 1, duration: 4 }, 54)
      .to(S, { wDial: 1, duration: 6, ease: 'power2.inOut' }, 55.5)
      .fromTo(S, { wSweep: -0.4 }, { wSweep: 1.4, duration: 7, ease: 'power1.inOut', immediateRender: false }, 57)
      .to(S, { wLit: 1, duration: 5 }, 58.5)
      .to(S, { orbA: 0, duration: 4 }, 59.5);

    // ── Scene 5 · the watch in weightlessness, camera approaches (61 → 78)
    tl.to(S, { limbA: 0.9, limbK: 1, duration: 11, ease: 'power2.out' }, 60)
      .to(S, { float: 1, duration: 6 }, 61)
      .to(S, { wZoom: 1, duration: 17, ease: 'power1.inOut' }, 63)
      .fromTo(S, { wSweep: -0.4 }, { wSweep: 1.4, duration: 10, ease: 'power1.inOut', immediateRender: false }, 67)
      .to(S, { camZ: 1.05, camX: 0, duration: 18 }, 62)
      .to(S, { float: 0, duration: 4 }, 75.5);

    // ── Scene 6 · cinematic close-up (79 → 100)
    tl.to(S, { seqA: 1, duration: 3.5 }, 78.5)
      .to(S, { wA: 0, duration: 2.5 }, 81)
      .to(S, { limbA: 0, starA: 0.3, duration: 4 }, 78.5)
      .to(S, { dialF: 1, duration: 11 }, 78.5)
      .to(S, { macroMix: 1, duration: 2.6, ease: "sine.inOut" }, 88.4)
      .to(S, { macroF: 1, duration: 11.5 }, 88.5)
      .to(S, { seqZoom: 1, duration: 21.5 }, 78.5)
      .set({}, {}, 100);

    return tl;
  }

  // ---- intro (time-based, plays once after load) -----------------------------------------
  function intro() {
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.to('.loader', { autoAlpha: 0, duration: 0.9, ease: 'power2.inOut' }, 0)
      .to(S, { starA: 1, duration: 2.6, ease: 'power1.inOut' }, 0.2)
      .to(S, { intro: 1, duration: 3.6, ease: 'power2.out' }, 0.5)
      .fromTo('.title--65 .digit', { yPercent: 110 }, { yPercent: 0, duration: 1.9, stagger: 0.14, ease: 'expo.out' }, 1.1)
      .fromTo('.title--65 .title__info > *', { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 1.4, stagger: 0.16 }, 1.8)
      .fromTo(['.brand', '.hud'], { autoAlpha: 0 }, { autoAlpha: 1, duration: 1.4, ease: 'power1.out' }, 2.2)
      .add(() => {
        document.body.classList.remove('is-loading');
        ScrollTrigger.refresh();
      }, 1.6);
    return tl;
  }

  // ---- loading ---------------------------------------------------------------------------
  function loadAll() {
    const bar = $('.loader__bar span');
    const pct = $('.loader__pct');
    const img = (src) => { const i = new Image(); i.src = src; return i.decode().catch(() => {}); };
    const videoReady = new Promise((res) => {
      if (video.readyState >= 3) return res();
      video.addEventListener('canplay', res, { once: true });
      video.addEventListener('error', res, { once: true });
    });
    const total = 4 + seqDial.count + seqMacro.count;
    let done = 0;
    const tick = () => {
      done++;
      const p = Math.min(1, done / total);
      gsap.to(bar, { scaleX: p, duration: 0.4, ease: 'power2.out', overwrite: true });
      pct.textContent = String(Math.round(p * 100)).padStart(3, '0');
    };
    const step = (p) => p.then(tick);
    const all = Promise.all([
      step(img('assets/K3_Б-high_res.png')),
      step(img('assets/space_earth_1.jpg')),
      step(document.fonts ? document.fonts.ready : Promise.resolve()),
      step(videoReady),
      seqDial.load(tick),
      seqMacro.load(tick),
    ]);
    const timeout = new Promise((res) => setTimeout(res, 15000));
    return Promise.race([all, timeout]);
  }

  // ---- boot ------------------------------------------------------------------------------
  gsap.set(['.brand', '.hud'], { autoAlpha: 0 });
  gsap.set('.title--65 .digit', { yPercent: 110 });
  gsap.set('.title--65 .title__info > *', { autoAlpha: 0 });
  layout();
  const master = buildTimeline();
  gsap.ticker.add(render);
  new ResizeObserver(() => { if (stage.clientWidth !== W || stage.clientHeight !== H) layout(); }).observe(stage);
  video.play().catch(() => {});

  let introTl;
  loadAll().then(() => gsap.delayedCall(0.3, () => { if (!introTl) introTl = intro(); }));

  // ?debug → window.cosmos.seek(p) jumps the whole scene to a progress value and renders it
  if (/[?&]debug/.test(location.search)) {
    window.cosmos = {
      S, master,
      seek(p) {
        if (!introTl) introTl = intro();
        introTl.progress(1);
        gsap.set('.loader', { autoAlpha: 0 });
        gsap.set(['.brand', '.hud'], { autoAlpha: 1 });
        document.body.classList.remove('is-loading');
        const st = master.scrollTrigger;
        st.scroll(st.start + (st.end - st.start) * p);
        st.update();
        const tw = st.getTween && st.getTween();
        if (tw) tw.progress(1);
        master.progress(p);
        progress = p;
        render();
        return p;
      },
    };
  }
})();
