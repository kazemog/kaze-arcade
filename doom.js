(() => {
  const cv = document.getElementById('fc'), cx = cv.getContext('2d'), W = 360, H = 225;
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
  let px = 1.5, py = 1.5, pa = 0.2, hp = 100, ammo = 30, score = 0, flash = 0, hurt = 0;
  let keys = { u: false, l: false, r: false };
  let enemies = [
    { x: 3.5, y: 1.5, hp: 2, cd: 50 },
    { x: 6.5, y: 1.5, hp: 2, cd: 80 },
    { x: 4.5, y: 3.5, hp: 2, cd: 65 },
    { x: 6.5, y: 5.5, hp: 2, cd: 90 },
    { x: 2.5, y: 6.5, hp: 2, cd: 70 }
  ];
  let shots = [];

  function bindHold(id, k) {
    const el = document.getElementById(id);
    const on = e => { e.preventDefault(); keys[k] = true; };
    const off = () => { keys[k] = false; };
    el.addEventListener('pointerdown', on);
    el.addEventListener('pointerup', off);
    el.addEventListener('pointerleave', off);
    el.addEventListener('pointercancel', off);
  }
  bindHold('btnUp', 'u'); bindHold('btnL', 'l'); bindHold('btnR', 'r');

  function resetDoom() {
    px = 1.5; py = 1.5; pa = 0.2; hp = 100; ammo = 30; score = 0; shots = [];
    enemies = [{x:3.5,y:1.5,hp:2,cd:50},{x:6.5,y:1.5,hp:2,cd:80},{x:4.5,y:3.5,hp:2,cd:65},{x:6.5,y:5.5,hp:2,cd:90},{x:2.5,y:6.5,hp:2,cd:70}];
  }

  document.getElementById('btnF').addEventListener('pointerdown', e => {
    e.preventDefault();
    if (hp <= 0 || enemies.every(x => x.hp <= 0)) return resetDoom();
    if (ammo <= 0) ammo = 30;
    ammo--; flash = 4;
    let best = null, bestD = 99;
    for (const en of enemies) {
      if (en.hp <= 0) continue;
      const dx = en.x - px, dy = en.y - py, dist = Math.hypot(dx, dy);
      let ang = Math.atan2(dy, dx) - pa;
      while (ang < -Math.PI) ang += Math.PI * 2;
      while (ang > Math.PI) ang -= Math.PI * 2;
      if (Math.abs(ang) < 0.16 && dist < bestD) { best = en; bestD = dist; }
    }
    if (best) { best.hp--; score += best.hp <= 0 ? 100 : 25; }
  });

  function isWall(x, y) { return MAP[Math.floor(y)]?.[Math.floor(x)] !== 0; }

  setInterval(() => {
    if (activeTab !== 2) return;
    if (hp > 0) {
      if (keys.l) pa -= 0.065;
      if (keys.r) pa += 0.065;
      if (keys.u) {
        const nx = px + Math.cos(pa) * 0.075, ny = py + Math.sin(pa) * 0.075;
        if (!isWall(nx, py)) px = nx;
        if (!isWall(px, ny)) py = ny;
      }
    }

    // Ceiling & Floor
    cx.fillStyle = '#1b1412'; cx.fillRect(0, 0, W, H / 2);
    cx.fillStyle = '#29201c'; cx.fillRect(0, H / 2, W, H / 2);

    // Raycasting 3D Walls
    const FOV = 1.05, RAYS = 90, colW = W / RAYS, zBuf = new Float32Array(RAYS);
    for (let i = 0; i < RAYS; i++) {
      const ra = pa - FOV / 2 + (i / RAYS) * FOV;
      const cos = Math.cos(ra), sin = Math.sin(ra);
      let d = 0.05, hitSide = 0;
      while (d < 12) {
        const rx = px + cos * d, ry = py + sin * d;
        if (isWall(rx, ry)) {
          hitSide = (Math.abs(rx - Math.round(rx)) < 0.04) ? 1 : 0;
          break;
        }
        d += 0.04;
      }
      const corr = d * Math.cos(ra - pa);
      zBuf[i] = corr;
      const wh = Math.min(H, H / (corr + 0.001));
      const shade = Math.max(0.22, 1 - corr / 7.5);
      const r = Math.floor((hitSide ? 168 : 132) * shade);
      const g = Math.floor((hitSide ? 92 : 70) * shade);
      const b = Math.floor((hitSide ? 66 : 52) * shade);
      cx.fillStyle = `rgb(${r},${g},${b})`;
      cx.fillRect(i * colW, (H - wh) / 2, colW + 1, wh);
    }

    // Enemies + Green Projectiles
    const alive = enemies.filter(e => e.hp > 0).map(e => ({ e, d: Math.hypot(e.x - px, e.y - py) })).sort((a, b) => b.d - a.d);
    for (const { e, d } of alive) {
      let ang = Math.atan2(e.y - py, e.x - px) - pa;
      while (ang < -Math.PI) ang += Math.PI * 2;
      while (ang > Math.PI) ang -= Math.PI * 2;
      if (hp > 0 && d < 5.5 && --e.cd <= 0) {
        e.cd = 65 + Math.floor(Math.random() * 45);
        shots.push({ x: e.x, y: e.y, vx: (px - e.x) / d * 0.08, vy: (py - e.y) / d * 0.08 });
      }
      if (Math.abs(ang) < FOV * 0.65) {
        const sx = (0.5 + ang / FOV) * W, ri = Math.floor(sx / colW);
        if (ri >= 0 && ri < RAYS && d < zBuf[ri]) {
          const sh = Math.min(H * 0.85, (H / d) * 0.72), sw = sh * 0.52, sy = (H - sh) / 2 + sh * 0.1;
          cx.fillStyle = '#dc2626';
          cx.fillRect(sx - sw * 0.3, sy + sh * 0.25, sw * 0.6, sh * 0.45); // body
          cx.fillRect(sx - sw * 0.22, sy, sw * 0.44, sh * 0.22); // head
          cx.fillRect(sx - sw * 0.48, sy + sh * 0.28, sw * 0.16, sh * 0.32); // arms
          cx.fillRect(sx + sw * 0.32, sy + sh * 0.28, sw * 0.16, sh * 0.32);
          cx.fillRect(sx - sw * 0.26, sy + sh * 0.7, sw * 0.18, sh * 0.28); // legs
          cx.fillRect(sx + sw * 0.08, sy + sh * 0.7, sw * 0.18, sh * 0.28);
          cx.fillStyle = '#fde047';
          cx.fillRect(sx - sw * 0.12, sy + sh * 0.07, sw * 0.08, sh * 0.05);
          cx.fillRect(sx + sw * 0.04, sy + sh * 0.07, sw * 0.08, sh * 0.05);
        }
      }
    }

    // Update & Draw Green Enemy Shots
    shots = shots.filter(s => {
      s.x += s.vx; s.y += s.vy;
      if (isWall(s.x, s.y)) return false;
      const d = Math.hypot(s.x - px, s.y - py);
      if (d < 0.35) { hp = Math.max(0, hp - 5); hurt = 5; return false; }
      let ang = Math.atan2(s.y - py, s.x - px) - pa;
      while (ang < -Math.PI) ang += Math.PI * 2;
      while (ang > Math.PI) ang -= Math.PI * 2;
      if (Math.abs(ang) < FOV * 0.6) {
        const sx = (0.5 + ang / FOV) * W, sz = Math.max(6, 22 / d);
        cx.fillStyle = '#22c55e'; cx.fillRect(sx - sz / 2, H / 2 - sz / 2, sz, sz);
      }
      return true;
    });

    // Gun + Flash + Crosshair
    if (flash > 0) { cx.fillStyle = '#facc15'; cx.beginPath(); cx.arc(W / 2, H - 46, 16, 0, 7); cx.fill(); flash--; }
    cx.fillStyle = '#1f2937'; cx.fillRect(W / 2 - 22, H - 36, 44, 36);
    cx.fillStyle = '#374151'; cx.fillRect(W / 2 - 8, H - 48, 16, 16);
    cx.fillStyle = '#ffffff'; cx.fillRect(W / 2 - 5, H / 2 - 1, 10, 2); cx.fillRect(W / 2 - 1, H / 2 - 5, 2, 10);
    if (hurt > 0) { cx.fillStyle = 'rgba(220,38,38,.3)'; cx.fillRect(0, 0, W, H); hurt--; }

    if (hp <= 0 || alive.length === 0) {
      cx.fillStyle = 'rgba(11,20,26,.75)'; cx.fillRect(0, 0, W, H);
      cx.fillStyle = '#00a884'; cx.font = 'bold 18px sans-serif';
      cx.fillText(alive.length === 0 ? 'MENANG! TEKAN 🔥 ULANG' : 'KALAH! TEKAN 🔥 ULANG', 62, H / 2);
    }
    document.getElementById('dhp').innerText = 'HP ' + hp;
    document.getElementById('dam').innerText = `AMMO ${ammo} • SCORE ${score}`;
    document.getElementById('drem').innerText = `${alive.length} musuh tersisa`;
  }, 33);
})();
