/* Sparse 3D starfield. Stars live in a unit volume; the camera pans (camX/camY),
   rolls, and travels forward (camZ). Nothing here animates on its own except a faint twinkle
   and an almost imperceptible drift, so space feels alive but still. */
(function () {
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function Starfield(canvas) {
    const ctx = canvas.getContext('2d');
    let W = 0, H = 0, dpr = 1, stars = [];

    function build() {
      const rnd = mulberry32(1961);
      const count = Math.round(Math.min(320, Math.max(120, (W * H) / 8200)));
      stars = [];
      for (let i = 0; i < count; i++) {
        const bright = rnd() < 0.05;
        const tint = rnd();
        stars.push({
          x: (rnd() * 2 - 1) * 1.25,
          y: (rnd() * 2 - 1) * 1.25,
          z: rnd(),
          s: bright ? 0.9 + rnd() * 0.6 : 0.3 + rnd() * 0.55,
          a: bright ? 0.95 : 0.22 + rnd() * 0.5,
          p: rnd() * Math.PI * 2,
          tw: 0.3 + rnd() * 1.2,
          c: tint < 0.2 ? '196,214,255' : tint < 0.27 ? '255,238,220' : '238,241,245',
        });
      }
    }

    function resize(w, h, d) {
      W = w; H = h; dpr = d;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      build();
    }

    function render(S, t, still, occluder) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      if (S.starA <= 0.002) return;

      const cx = W / 2, cy = H / 2;
      const F = Math.max(W, H) * 0.52;
      const travel = S.camZ + (still ? 0 : t * 0.0025);
      const roll = (S.roll * Math.PI) / 180;
      const cr = Math.cos(roll), sr = Math.sin(roll);

      for (let i = 0; i < stars.length; i++) {
        const st = stars[i];
        let z = st.z - travel;
        z -= Math.floor(z);                       // 0 = at the camera, 1 = far away
        const zz = 0.16 + z * 0.84;

        const px = (st.x - S.camX * (1.15 - z)) / zz;
        const py = (st.y - S.camY * (1.15 - z)) / zz;
        const x = cx + (px * cr - py * sr) * F;
        const y = cy + (px * sr + py * cr) * F;
        if (x < -4 || y < -4 || x > W + 4 || y > H + 4) continue;
        if (occluder) {
          const dx = x - occluder.x, dy = y - occluder.y;
          if (dx * dx + dy * dy < occluder.r * occluder.r) continue;
        }

        const fade = Math.min(1, z / 0.12) * Math.min(1, (1 - z) / 0.25);
        const tw = still ? 1 : 0.72 + 0.28 * Math.sin(t * st.tw + st.p);
        const alpha = st.a * fade * tw * S.starA;
        if (alpha < 0.02) continue;

        const size = st.s * Math.min(2.4, Math.pow(0.55 / zz, 0.6));
        ctx.fillStyle = 'rgba(' + st.c + ',' + alpha.toFixed(3) + ')';
        if (size < 0.9) {
          ctx.fillRect(x, y, size * 1.3, size * 1.3);
        } else {
          ctx.beginPath();
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    return { resize, render };
  }

  window.Starfield = Starfield;
})();
