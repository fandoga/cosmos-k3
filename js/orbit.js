/* Orbital trajectory: a true 3D circle projected to screen.
   tilt 90° = edge-on, 0° = facing the camera. Swinging tilt → 0 while pushing the ring
   toward the camera is what turns the orbit into the light ring that becomes the dial. */
(function () {
  const TAU = Math.PI * 2;
  const N = 320;

  function Orbit(canvas) {
    const ctx = canvas.getContext('2d');
    let W = 0, H = 0, dpr = 1;
    const pts = new Array(N + 1);
    for (let i = 0; i <= N; i++) pts[i] = { x: 0, y: 0, z: 0, hidden: false };

    function resize(w, h, d) {
      W = w; H = h; dpr = d;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
    }

    // o: { cx, cy, R, tilt, roll, push, start, draw, dot, trail, glow, alpha, earth:{x,y,r,a} }
    function project(o, theta, out) {
      const inc = (o.tilt * Math.PI) / 180;
      const roll = (o.roll * Math.PI) / 180;
      const lx = o.R * Math.cos(theta);
      const ly = o.R * Math.sin(theta) * Math.cos(inc);
      const lz = o.R * Math.sin(theta) * Math.sin(inc);
      const P = H * 2.6;
      const f = P / Math.max(P * 0.08, P - (lz + o.push));
      const rx = lx * Math.cos(roll) - ly * Math.sin(roll);
      const ry = lx * Math.sin(roll) + ly * Math.cos(roll);
      out.x = o.cx + rx * f;
      out.y = o.cy + ry * f;
      out.z = lz;
      // far half of the orbit passes behind the planet
      const e = o.earth;
      if (lz < 0 && e.a > 0.05) {
        const dx = out.x - e.x, dy = out.y - e.y;
        out.hidden = dx * dx + dy * dy < e.r * e.r * 0.985;
      } else {
        out.hidden = false;
      }
      return out;
    }

    function strokeRun(from, to, width, color) {
      ctx.lineWidth = width;
      ctx.strokeStyle = color;
      ctx.beginPath();
      let pen = false;
      for (let i = from; i <= to; i++) {
        const p = pts[i];
        if (p.hidden) { pen = false; continue; }
        if (!pen) { ctx.moveTo(p.x, p.y); pen = true; } else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }

    function render(o) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      if (o.alpha <= 0.002 || o.draw <= 0.0005) return;

      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const a = o.alpha;
      const g = o.glow;
      const span = o.draw * TAU;

      // ---- base trajectory (front half brighter than far half)
      const count = Math.max(2, Math.round(N * o.draw));
      for (let i = 0; i <= count; i++) project(o, o.start + (span * i) / count, pts[i]);

      // soft light body once the line starts to glow
      if (g > 0.01) {
        strokeRun(0, count, 9, 'rgba(143,176,224,' + (0.045 * g * a).toFixed(3) + ')');
        strokeRun(0, count, 3.2, 'rgba(170,198,240,' + (0.14 * g * a).toFixed(3) + ')');
      }

      // split into front / back so depth reads through brightness
      ctx.lineWidth = 1 + g * 0.35;
      let i = 0;
      while (i < count) {
        const front = pts[i].z >= 0;
        let j = i;
        while (j < count && (pts[j + 1].z >= 0) === front) j++;
        const base = front ? 0.62 : 0.26;
        const alpha = (base + (0.95 - base) * g) * a;
        strokeRun(i, Math.min(count, j + 1), 1 + g * 0.35, 'rgba(226,234,248,' + alpha.toFixed(3) + ')');
        i = j + 1;
      }

      // ---- the spacecraft and its trail
      if (o.dotA > 0.01) {
        const head = o.start + o.dot * TAU;
        const trail = Math.min(TAU, o.trail);
        const M = Math.max(8, Math.round(96 * (trail / TAU)) + 24);
        const seg = { x: 0, y: 0, z: 0, hidden: false };
        const prev = { x: 0, y: 0, z: 0, hidden: false };
        project(o, head - trail, prev);
        for (let k = 1; k <= M; k++) {
          const t = k / M;
          project(o, head - trail + trail * t, seg);
          if (!seg.hidden && !prev.hidden) {
            const fall = Math.pow(t, 1.7);
            const alpha = (fall + (1 - fall) * g) * 0.95 * a * o.dotA;
            ctx.lineWidth = 1.2 + 0.8 * t;
            ctx.strokeStyle = 'rgba(240,245,255,' + alpha.toFixed(3) + ')';
            ctx.beginPath();
            ctx.moveTo(prev.x, prev.y);
            ctx.lineTo(seg.x, seg.y);
            ctx.stroke();
          }
          prev.x = seg.x; prev.y = seg.y; prev.hidden = seg.hidden;
        }
        if (!seg.hidden) {
          const halo = ctx.createRadialGradient(seg.x, seg.y, 0, seg.x, seg.y, 16);
          halo.addColorStop(0, 'rgba(210,226,255,' + (0.42 * a * o.dotA).toFixed(3) + ')');
          halo.addColorStop(1, 'rgba(210,226,255,0)');
          ctx.fillStyle = halo;
          ctx.beginPath(); ctx.arc(seg.x, seg.y, 16, 0, TAU); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,' + (a * o.dotA).toFixed(3) + ')';
          ctx.beginPath(); ctx.arc(seg.x, seg.y, 2.1, 0, TAU); ctx.fill();
        }
      }
    }

    return { resize, render };
  }

  window.Orbit = Orbit;
})();
