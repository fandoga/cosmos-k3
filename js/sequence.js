/* Image sequences extracted from the K3 film. Scrubbing decoded frames on a canvas is
   frame-accurate and smooth in both directions, unlike seeking an <video> element. */
(function () {
  function Sequence(dir, count) {
    const frames = new Array(count);
    let loaded = 0;

    function load(onProgress) {
      const jobs = [];
      for (let i = 0; i < count; i++) {
        const img = new Image();
        img.decoding = 'async';
        img.src = dir + '/' + String(i).padStart(3, '0') + '.webp';
        jobs.push(
          img.decode().then(
            () => { frames[i] = img; loaded++; onProgress && onProgress(); },
            () => { loaded++; onProgress && onProgress(); }
          )
        );
      }
      return Promise.all(jobs);
    }

    // nearest decoded frame, so a slow network never shows a blank canvas
    function get(p) {
      const target = Math.round(Math.min(1, Math.max(0, p)) * (count - 1));
      for (let d = 0; d < count; d++) {
        if (frames[target - d]) return frames[target - d];
        if (frames[target + d]) return frames[target + d];
      }
      return null;
    }

    return { load, get, count, get loaded() { return loaded; } };
  }

  function Film(canvas) {
    const ctx = canvas.getContext('2d');
    let W = 0, H = 0, dpr = 1;
    let last = '';

    function resize(w, h, d) {
      W = w; H = h; dpr = d;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      last = '';
    }

    function cover(img, zoom, ox, oy, alpha) {
      const iw = img.naturalWidth, ih = img.naturalHeight;
      const s = Math.max(W / iw, H / ih) * zoom;
      const w = iw * s, h = ih * s;
      ctx.globalAlpha = alpha;
      ctx.drawImage(img, (W - w) / 2 + ox, (H - h) / 2 + oy, w, h);
    }

    // a: first sequence frame, b: second (crossfade by mix)
    function render(a, b, mix, zoom, ox, oy) {
      const key = (a && a.src) + '|' + (b && b.src) + '|' + mix.toFixed(3) + '|' + zoom.toFixed(4) + '|' + ox.toFixed(1) + '|' + oy.toFixed(1);
      if (key === last) return;
      last = key;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#030406';
      ctx.fillRect(0, 0, W, H);
      // dip through darkness instead of a double exposure between two different shots
      if (mix < 0.5) { if (a) cover(a, zoom, ox, oy, 1 - mix * 2); }
      else if (b) cover(b, zoom, ox, oy, mix * 2 - 1);
      ctx.globalAlpha = 1;
    }

    return { resize, render };
  }

  window.Sequence = Sequence;
  window.Film = Film;
})();
