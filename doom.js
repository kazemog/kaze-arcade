(() => {
  const cv = document.getElementById('fc'), cx = cv.getContext('2d');
  let W = 360, H = 230;
  function sizeDoom() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = cv.clientWidth || 360; H = 230;
    cv.width = W * dpr; cv.height = H * dpr; cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  sizeDoom(); window.addEventListener('resize', sizeDoom);

  const MAP = [
    [1,1,1,1,1,1,1,1],
    [1,0,0,0,0,1,0,1],
    [1,0,1,1,0,0,0,1],
    [1,0,0,0,0,1,0,1],
    [1,1,0,1,0,0,0,1],
    [1,0,0,0,0,1,0,1],
    [1,0,1,0,0,0,0,1],
    [1,1,1,1,1,1,1,1]
  ];
  let px = 1.5, py = 1.5, pa = 0.25, hp = 100, score = 0, flash = 0, hurt = 0, recoil = 0, bob = 0;
  let keys = { u: false, d: false, l: false, r: false }, dragX = null;
  let enemies = [], shots = [];

  function resetDoom() {
    px = 1.5; py = 1.5; pa = 0.25; hp = 100; score = 0; shots = [];
    enemies = [
      { x: 3.5, y: 1.5, hp: 3, max: 3, cd: 55 },
      { x: 6.5, y: 1.5, hp: 3, max: 3, cd: 80 },
      { x: 4.5, y: 3.5, hp: 3, max: 3, cd: 65 },
      { x: 6.5, y: 5.5, hp: 3, max: 3, cd: 90 },
      { x: 2.5, y: 6.5, hp: 3, max: 3, cd: 70 }
    ];
  }
  resetDoom();

  function bindHold(id, k) {
    const el = document.getElementById(id);
    const on = e => { e.preventDefault(); keys[k] = true; };
    const off = () => { keys[k] = false; };
    el.addEventListener('pointerdown', on);
    ['pointerup','pointerleave','pointercancel'].forEach(ev => el.addEventListener(ev, off));
  }
  bindHold('btnUp', 'u'); bindHold('btnDn', 'd'); bindHold('btnL', 'l'); bindHold('btnR', 'r');

  // Geser layar langsung untuk menengok kamera
  cv.addEventListener('pointerdown', e => { dragX = e.clientX; });
  cv.addEventListener('pointermove', e => { if (dragX !== null) { pa += (e.clientX - dragX) * 0.008; dragX = e.clientX; } });
  ['pointerup','pointercancel'].forEach(ev => cv.addEventListener(ev, () => { dragX = null; }));

  document.getElementById('btnF').addEventListener('pointerdown', e => {
    e.preventDefault();
    if (hp <= 0 || enemies.every(x => x.hp <= 0)) return resetDoom();
    flash = 4; recoil = 10; window.beep(190, .09, 'sawtooth', .11);
    let best = null, bestD = 99;
    for (const en of enemies) {
      if (en.hp <= 0) continue;
      const dist = Math.hypot(en.x - px, en.y - py);
      let ang = Math.atan2(en.y - py, en.x - px) - pa;
      while (ang < -Math.PI) ang += Math.PI * 2; while (ang > Math.PI) ang -= Math.PI * 2;
      if (Math.abs(ang) < 0.17 && dist < bestD) { best = en; bestD = dist; }
    }
    if (best) { best.hp--; score += best.hp <= 0 ? 150 : 35; window.beep(best.hp <= 0 ? 720 : 480, .08); }
  });

  const isWall = (x, y) => MAP[Math.floor(y)]?.[Math.floor(x)] !== 0;

  setInterval(() => {
    if (window.KAZE_TAB !== 2) return;
    if (hp > 0) {
      if (keys.l) pa -= 0.065;
      if (keys.r) pa += 0.065;
      const mv = (keys.u ? 0.075 : 0) - (keys.d ? 0.055 : 0);
      if (mv) {
        bob += 0.25;
        const nx = px + Math.cos(pa) * mv, ny = py + Math.sin(pa) * mv;
        if (!isWall(nx, py)) px = nx;
        if (!isWall(px, ny)) py = ny;
      }
    }

    // Midnight Sky & Floor Gradient
    const g1 = cx.createLinearGradient(0, 0, 0, H / 2);
    g1.addColorStop(0, '#070a14'); g1.addColorStop(1, '#1a1236');
    cx.fillStyle = g1; cx.fillRect(0, 0, W, H / 2);
    const g2 = cx.createLinearGradient(0, H / 2, 0, H);
    g2.addColorStop(0, '#111827'); g2.addColorStop(1, '#1e293b');
    cx.fillStyle = g2; cx.fillRect(0, H / 2, W, H / 2);

    // Raycasting 3D Cyber Walls
    const FOV = 1.05, RAYS = 100, colW = W / RAYS, zBuf = new Float32Array(RAYS);
    for (let i = 0; i < RAYS; i++) {
      const ra = pa - FOV / 2 + (i / RAYS) * FOV, cos = Math.cos(ra), sin = Math.sin(ra);
      let d = 0.05, side = 0, tx = 0;
      while (d < 11) {
        const rx = px + cos * d, ry = py + sin * d;
        if (isWall(rx, ry)) { side = Math.abs(rx - Math.round(rx)) < 0.04 ? 1 : 0; tx = (rx + ry) % 1; break; }
        d += 0.035;
      }
      const corr = d * Math.cos(ra - pa); zBuf[i] = corr;
      const wh = Math.min(H, H / (corr + 0.001)), sh = Math.max(0.18, 1 - corr / 7.5);
      const stripe = (tx < 0.08 || tx > 0.92) ? 1.25 : 1;
      cx.fillStyle = `rgb(${Math.min(255,(side?96:64)*sh*stripe)|0},${Math.min(255,(side?75:58)*sh*stripe)|0},${Math.min(255,(side?180:145)*sh*stripe)|0})`;
      cx.fillRect(i * colW, (H - wh) / 2, colW + 1, wh);
    }

    // Enemies with HP bar
    const alive = enemies.filter(e => e.hp > 0).map(e => ({ e, d: Math.hypot(e.x - px, e.y - py) })).sort((a, b) => b.d - a.d);
    for (const { e, d } of alive) {
      let ang = Math.atan2(e.y - py, e.x - px) - pa;
      while (ang < -Math.PI) ang += Math.PI * 2; while (ang > Math.PI) ang -= Math.PI * 2;
      if (hp > 0 && d < 5.5 && --e.cd <= 0) {
        e.cd = 65 + Math.floor(Math.random() * 40);
        shots.push({ x: e.x, y: e.y, vx: (px - e.x) / d * 0.085, vy: (py - e.y) / d * 0.085 });
      }
      if (Math.abs(ang) < FOV * 0.65) {
        const sx = (0.5 + ang / FOV) * W, ri = Math.floor(sx / colW);
        if (ri >= 0 && ri < RAYS && d < zBuf[ri]) {
          const sh = Math.min(H * 0.85, (H / d) * 0.72), sw = sh * 0.52, sy = (H - sh) / 2 + sh * 0.1;
          cx.fillStyle = '#e11d48'; cx.beginPath(); cx.roundRect(sx - sw * .34, sy + sh * .22, sw * .68, sh * .52, 6); cx.fill();
          cx.fillStyle = '#be123c'; cx.beginPath(); cx.roundRect(sx - sw * .24, sy, sw * .48, sh * .24, 5); cx.fill();
          cx.fillStyle = '#fde047'; cx.fillRect(sx - sw * .13, sy + sh * .08, sw * .08, sh * .05); cx.fillRect(sx + sw * .05, sy + sh * .08, sw * .08, sh * .05);
          // Enemy HP bar
          cx.fillStyle = 'rgba(0,0,0,.6)'; cx.fillRect(sx - sw * .35, sy - 8, sw * .7, 4);
          cx.fillStyle = '#00d4aa'; cx.fillRect(sx - sw * .35, sy - 8, (sw * .7) * (e.hp / e.max), 4);
        }
      }
    }

    // Enemy Plasma Shots
    shots = shots.filter(s => {
      s.x += s.vx; s.y += s.vy; if (isWall(s.x, s.y)) return false;
      const d = Math.hypot(s.x - px, s.y - py);
      if (d < 0.35) { hp = Math.max(0, hp - 8); hurt = 5; window.beep(120, .12, 'sawtooth'); return false; }
      let ang = Math.atan2(s.y - py, s.x - px) - pa;
      while (ang < -Math.PI) ang += Math.PI * 2; while (ang > Math.PI) ang -= Math.PI * 2;
      if (Math.abs(ang) < FOV * 0.6) {
        const sx = (0.5 + ang / FOV) * W, sz = Math.max(5, 18 / d);
        cx.fillStyle = '#00d4aa'; cx.beginPath(); cx.arc(sx, H / 2, sz / 2, 0, 7); cx.fill();
      }
      return true;
    });

    // Gun + Recoil + Crosshair
    if (recoil > 0) recoil -= 1.5;
    const by = Math.sin(bob) * 3 + recoil;
    if (flash > 0) { cx.fillStyle = '#fde047'; cx.beginPath(); cx.arc(W / 2, H - 52 + by, 17, 0, 7); cx.fill(); flash--; }
    cx.fillStyle = '#1e293b'; cx.fillRect(W / 2 - 22, H - 38 + by, 44, 42);
    cx.fillStyle = '#6366f1'; cx.fillRect(W / 2 - 7, H - 52 + by, 14, 18);
    cx.strokeStyle = '#00d4aa'; cx.lineWidth = 1.5; cx.beginPath(); cx.arc(W / 2, H / 2, 7, 0, 7); cx.stroke();

    // Radar Minimap (Pojok Kiri Atas)
    const ms = 7;
    cx.fillStyle = 'rgba(7,10,18,.72)'; cx.fillRect(6, 6, 8 * ms + 4, 8 * ms + 4);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (MAP[y][x]) { cx.fillStyle = '#4c1d95'; cx.fillRect(8 + x * ms, 8 + y * ms, ms - 1, ms - 1); }
    alive.forEach(({ e }) => { cx.fillStyle = '#f43f5e'; cx.fillRect(8 + e.x * ms - 2, 8 + e.y * ms - 2, 4, 4); });
    cx.fillStyle = '#00d4aa'; cx.fillRect(8 + px * ms - 2, 8 + py * ms - 2, 4, 4);

    if (hurt > 0) { cx.fillStyle = 'rgba(244,63,94,.28)'; cx.fillRect(0, 0, W, H); hurt--; }
    if (hp <= 0 || !alive.length) {
      cx.fillStyle = 'rgba(7,10,18,.78)'; cx.fillRect(0, 0, W, H);
      cx.fillStyle = '#fff'; cx.font = 'bold 17px sans-serif'; cx.textAlign = 'center';
      cx.fillText(!alive.length ? '🏆 MENANG! TEKAN 🔥 ULANG' : '💀 KALAH! TEKAN 🔥 ULANG', W / 2, H / 2);
      cx.textAlign = 'left';
    }
    document.getElementById('dhp').innerText = hp;
    document.getElementById('dam').innerText = score;
    document.getElementById('drem').innerText = `Geser layar untuk menengok • ${alive.length} musuh tersisa`;
  }, 33);
})();
