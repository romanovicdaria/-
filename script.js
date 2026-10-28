(function () {
  'use strict';

  // ============================================================
  //  УРОВНИ (МИССИИ)
  // ============================================================
  var MISSIONS = [
    {
      id: 'free',
      name: 'Свободный полёт',
      desc: 'Попади в зону стыковки с малой скоростью.',
      start: { x: -220, y: 0, vx: 30, vy: 0 },
      fuel: 30,
      dockR: 42,
      maxSpeed: 22,
      timeLimit: 2400
    },
    {
      id: 'rbar',
      name: 'Подход сверху (R-bar)',
      desc: 'Станция сверху. Подойди аккуратно.',
      start: { x: 0, y: 200, vx: 0, vy: -20 },
      fuel: 26,
      dockR: 38,
      maxSpeed: 18,
      timeLimit: 2600
    },
    {
      id: 'vbartight',
      name: 'Узкий коридор (V-bar)',
      desc: 'Попади в узкий коридор, скорость строго ниже 12.',
      start: { x: -260, y: 0, vx: 25, vy: 0 },
      fuel: 22,
      dockR: 32,
      maxSpeed: 12,
      timeLimit: 2600
    }
  ];

  // ============================================================
  //  СТАНЦИИ
  // ============================================================
  var STATIONS = [
    { id: 'iss', name: 'МКС-стиль', scale: 1.0, color: '#ffb84d', accentColor: '#c8842a' },
    { id: 'mir', name: '«Мир»', scale: 0.85, color: '#d6e6ff', accentColor: '#7d8a9c' },
    { id: 'soyuz', name: 'Модуль «Союз»', scale: 0.7, color: '#a3e2b3', accentColor: '#2e7d4f' }
  ];

  // ============================================================
  //  КОРАБЛИ
  // ============================================================
  var SHIPS = [
    { 
      id: 'soyuz', 
      name: '«Союз»', 
      color: '#a3e2b3', 
      accentColor: '#2e7d4f',
      turnSpeed: 0.06,
      fuelCost: 1.0
    },
    { 
      id: 'dragon', 
      name: 'Crew Dragon', 
      color: '#ffffff', 
      accentColor: '#555555',
      turnSpeed: 0.09,
      fuelCost: 1.3
    },
    { 
      id: 'orion', 
      name: '«Орион»', 
      color: '#d4af37', 
      accentColor: '#8b6508',
      turnSpeed: 0.04,
      fuelCost: 0.8
    }
  ];

  // ---------- Константы ----------
  var SCALE = 1.6;
  var STATION_R = 18;
  var DT = 0.05;

  // ---------- DOM ----------
  var canvas = document.getElementById('scene');
  var ctx = canvas.getContext('2d');
  var msgEl = document.getElementById('msg');
  var toastEl = document.getElementById('toast');
  var hudDist = document.getElementById('hud-dist');
  var hudSpeed = document.getElementById('hud-speed');
  var hudRange = document.getElementById('hud-range');
  var hudTime = document.getElementById('hud-time');
  var hudDv = document.getElementById('hud-dv');
  var hudGoal = document.getElementById('hud-goal');
  var hudStatus = document.getElementById('hud-status');
  var fuelNum = document.getElementById('fuel-num');
  var fuelFill = document.getElementById('fuel-fill');
  var missionNameEl = document.getElementById('mission-name');
  var stationNameEl = document.getElementById('station-name');

  var sDv = document.getElementById('s-dv');
  var sAng = document.getElementById('s-ang');
  var vDv = document.getElementById('v-dv');
  var vAng = document.getElementById('v-ang');

  var btnStart = document.getElementById('btn-start');
  var btnBurn = document.getElementById('btn-burn');
  var btnReset = document.getElementById('btn-reset');

  // ---------- Текущие выборы ----------
  var mission = MISSIONS[0];
  var station = STATIONS[0];
  var ship = SHIPS[0];

  // ---------- Состояние ----------
  var state = {
    running: false,
    finished: false,
    docked: false, // Флаг успешной стыковки
    t: 0,
    step: 0,
    ship: { x: 0, y: 0, vx: 0, vy: 0 },
    stationPos: { x: 0, y: 0 },
    stationVel: { x: 0, y: 0 },
    stationAngle: 0,
    shipAngle: 0,
    totalDv: 0,
    fuel: 30,
    burnTimer: 0,
    trail: [],
    ghostTrails: [],
    cam: { x: 0, y: 0 }
  };

  // ---------- Размер canvas ----------
  function resize() {
    var wrap = canvas.parentElement;
    var dpr = window.devicePixelRatio || 1;
    var w = wrap.clientWidth;
    var h = wrap.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  // ---------- Координаты ----------
  function toScreen(x, y) {
    var w = canvas.clientWidth;
    var h = canvas.clientHeight;
    return {
      x: w / 2 + (x - state.cam.x) * SCALE,
      y: h / 2 - (y - state.cam.y) * SCALE
    };
  }

  // ---------- Ползунки ----------
  function syncOutputs() {
    vDv.textContent = parseFloat(sDv.value).toFixed(1);
    vAng.textContent = parseFloat(sAng.value).toFixed(0) + '°';
  }

  // ---------- Сброс ----------
  function resetRound(resetSliders) {
    state.running = false;
    state.finished = false;
    state.docked = false;
    state.t = 0;
    state.step = 0;
    state.trail = [];
    state.burnTimer = 0;
    state.totalDv = 0;
    state.cam.x = 0;
    state.cam.y = 0;
    
    state.stationPos = { x: 0, y: 0 };
    state.stationVel = { x: 0, y: -1.5 };
    state.stationAngle = 0;

    if (state.ship.x !== 0 || state.ship.y !== 0) {
      state.ghostTrails.push(state.trail.slice());
      if (state.ghostTrails.length > 3) state.ghostTrails.shift();
    }

    if (resetSliders) {
      sDv.value = 0;
      sAng.value = 0;
      syncOutputs();
    }

    state.fuel = mission.fuel;
    state.ship.x = mission.start.x;
    state.ship.y = mission.start.y;
    state.ship.vx = mission.start.vx;
    state.ship.vy = mission.start.vy;
    
    state.shipAngle = Math.atan2(state.ship.vy, state.ship.vx);
    if (state.ship.vx === 0 && state.ship.vy === 0) state.shipAngle = 0;

    msgEl.className = 'msg';
    msgEl.textContent = '';
    hudStatus.textContent = 'ожидание';
    hudStatus.style.color = '';
    btnBurn.disabled = true;

    updateHud();
    updateFuel();
    draw();
  }

  // ---------- Старт ----------
  function startSim() {
    if (state.running) return;
    resetRound(false);

    var dv0 = parseFloat(sDv.value);
    var ang0 = parseFloat(sAng.value);
    if (dv0 > state.fuel) dv0 = state.fuel;
    
    if (dv0 > 0) {
      var rad = state.shipAngle + ang0 * Math.PI / 180;
      state.ship.vx += dv0 * Math.cos(rad);
      state.ship.vy += dv0 * Math.sin(rad);
      state.totalDv += dv0;
      state.fuel -= dv0 * ship.fuelCost;
      if (state.fuel < 0) state.fuel = 0;
      state.burnTimer = 0.4;
      updateFuel();
    }

    state.running = true;
    state.finished = false;
    hudStatus.textContent = 'полёт';
    hudStatus.style.color = '#4da6ff';
    msgEl.className = 'msg';
    msgEl.textContent = '';
    btnBurn.disabled = false;
    requestAnimationFrame(loop);
  }

  // ---------- Импульс в полёте ----------
  function burnNow() {
    if (!state.running || state.finished || state.docked) return;
    var dv = parseFloat(sDv.value);
    var ang = parseFloat(sAng.value);
    if (dv <= 0) return;
    if (dv > state.fuel) dv = state.fuel;
    if (dv <= 0) return;

    var rad = state.shipAngle + ang * Math.PI / 180;

    state.ship.vx += dv * Math.cos(rad);
    state.ship.vy += dv * Math.sin(rad);
    state.totalDv += dv;
    state.fuel -= dv * ship.fuelCost;
    if (state.fuel < 0) state.fuel = 0;
    state.burnTimer = 0.4;
    updateFuel();
    updateHud();
    showToast('Импульс +' + dv.toFixed(1));
  }

  // ---------- Физика (Инерциальная, упрощённая) ----------
  function stepPhysics() {
    if (state.finished) return;

    // Если состыковались — движемся вместе со станцией
    if (state.docked) {
      state.t += DT;
      state.stationAngle += 0.01;
      state.stationPos.x += state.stationVel.x * DT;
      state.stationPos.y += state.stationVel.y * DT;
      
      state.ship.x = state.stationPos.x;
      state.ship.y = state.stationPos.y;
      state.ship.vx = state.stationVel.x;
      state.ship.vy = state.stationVel.y;
      
      updateCamera();
      updateHud();
      return;
    }

    // 1. Движение станции
    state.stationAngle += 0.01;
    state.stationPos.x += state.stationVel.x * DT;
    state.stationPos.y += state.stationVel.y * DT;
    if (state.stationPos.y < -150) state.stationVel.y = 1.5;
    if (state.stationPos.y > 150) state.stationVel.y = -1.5;

    // 2. Движение корабля (Только по инерции)
    state.ship.x += state.ship.vx * DT;
    state.ship.y += state.ship.vy * DT;
    state.t += DT;
    state.step++;

    if (state.burnTimer > 0) state.burnTimer -= DT;

    if (state.step % 2 === 0) {
      state.trail.push({ x: state.ship.x, y: state.ship.y });
      if (state.trail.length > 900) state.trail.shift();
    }

    updateCamera();
    checkResult();
  }

  function updateCamera() {
    var tx = (state.ship.x + state.stationPos.x) * 0.5;
    var ty = (state.ship.y + state.stationPos.y) * 0.5;
    var maxCam = 260;
    if (tx > maxCam) tx = maxCam;
    if (tx < -maxCam) tx = -maxCam;
    if (ty > maxCam) ty = maxCam;
    if (ty < -maxCam) ty = -maxCam;
    state.cam.x += (tx - state.cam.x) * 0.08;
    state.cam.y += (ty - state.cam.y) * 0.08;
  }

  function checkResult() {
    if (state.docked) return; // Уже состыковались

    var dx = state.ship.x - state.stationPos.x;
    var dy = state.ship.y - state.stationPos.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    var speed = Math.sqrt(state.ship.vx * state.ship.vx + state.ship.vy * state.ship.vy);

    // Успешная стыковка
    if (dist <= mission.dockR && speed <= mission.maxSpeed) {
      state.docked = true;
      hudStatus.textContent = 'состыковано';
      hudStatus.style.color = '#4cd964';
      msgEl.className = 'msg show ok';
      msgEl.textContent = 'Успешная стыковка! Корабль пристыкован к станции.';
      btnBurn.disabled = true;
      
      // Выравниваем угол корабля под станцию
      state.shipAngle = state.stationAngle;
      return;
    }
    if (Math.abs(state.ship.x) > 1200 || Math.abs(state.ship.y) > 900) {
      finish(false, 'Аппарат ушёл за пределы зоны.');
      return;
    }
    if (dist < STATION_R * 0.6) {
      finish(false, 'Столкновение со станцией! Скорость ' + speed.toFixed(1) + '.');
      return;
    }
    if (state.step >= mission.timeLimit) {
      finish(false, 'Время вышло.');
      return;
    }
  }

  function finish(ok, text) {
    state.running = false;
    state.finished = true;
    hudStatus.textContent = ok ? 'успех' : 'неудача';
    hudStatus.style.color = ok ? '#4cd964' : '#ff4d4d';
    msgEl.className = 'msg show ' + (ok ? 'ok' : 'err');
    msgEl.textContent = text;
    btnBurn.disabled = true;
    updateHud();
    draw();
  }

  // ---------- HUD ----------
  function updateHud() {
    var dx = state.ship.x - state.stationPos.x;
    var dy = state.ship.y - state.stationPos.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    var speed = Math.sqrt(state.ship.vx * state.ship.vx + state.ship.vy * state.ship.vy);

    var rangeRate = 0;
    if (dist > 0.001) {
      var nx = dx / dist;
      var ny = dy / dist;
      rangeRate = -(state.ship.vx * nx + state.ship.vy * ny);
    }

    hudDist.textContent = dist.toFixed(1);
    hudSpeed.textContent = speed.toFixed(1);
    hudRange.textContent = rangeRate.toFixed(1);
    hudTime.textContent = state.t.toFixed(1);
    hudDv.textContent = state.totalDv.toFixed(1);
    hudGoal.textContent = '≤' + mission.maxSpeed + ' / ' + mission.dockR;
  }

  function updateFuel() {
    fuelNum.textContent = state.fuel.toFixed(1) + ' / ' + mission.fuel;
    var pct = Math.max(0, Math.min(1, state.fuel / mission.fuel));
    fuelFill.style.width = (pct * 100).toFixed(1) + '%';
  }

  var toastTimer = null;
  function showToast(text) {
    toastEl.textContent = text;
    toastEl.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.classList.remove('show');
    }, 900);
  }

  // ============================================================
  //  Отрисовка
  // ============================================================
  function makeStars(w, h) {
    var n = Math.min(220, Math.floor(w * h / 5500));
    var arr = [];
    for (var i = 0; i < n; i++) {
      arr.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.4 + 0.15,
        phase: Math.random() * Math.PI * 2,
        speed: 0.3 + Math.random() * 0.8,
        layer: Math.random() < 0.5 ? 1 : (Math.random() < 0.6 ? 2 : 3)
      });
    }
    return arr;
  }

  function drawStars(w, h, t) {
    if (!drawStars._stars || drawStars._w !== w || drawStars._h !== h) {
      drawStars._stars = makeStars(w, h);
      drawStars._w = w;
      drawStars._h = h;
    }
    var stars = drawStars._stars;
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var alpha = 0.35 + 0.4 * (0.5 + 0.5 * Math.sin(t * s.speed + s.phase));
      var offsetX = (state.cam.x * 0.05) * s.layer;
      var offsetY = (state.cam.y * 0.05) * s.layer;
      var x = s.x + offsetX;
      var y = s.y - offsetY;
      x = ((x % w) + w) % w;
      y = ((y % h) + h) % h;
      ctx.fillStyle = 'rgba(255,255,255,' + alpha.toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(x, y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawGrid() {
    var w = canvas.clientWidth;
    var h = canvas.clientHeight;
    var stepPx = 40;
    var origin = toScreen(0, 0);
    var startX = ((origin.x % stepPx) + stepPx) % stepPx;
    var startY = ((origin.y % stepPx) + stepPx) % stepPx;

    ctx.strokeStyle = 'rgba(120,160,220,0.08)';
    ctx.lineWidth = 1;
    for (var x = startX; x < w; x += stepPx) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (var y = startY; y < h; y += stepPx) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
  }

  // ----- Станции -----
  function drawStation(cx, cy, angle) {
    var sc = station.scale;
    var r = STATION_R * SCALE * 0.5 * sc;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);

    var glow = ctx.createRadialGradient(0, 0, r, 0, 0, r * 3.4);
    glow.addColorStop(0, hexToRgba(station.color, 0.3));
    glow.addColorStop(1, hexToRgba(station.color, 0));
    ctx.beginPath();
    ctx.arc(0, 0, r * 3.4, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    var panelW = 52 * sc, panelH = 14 * sc;
    if (station.id === 'mir') {
      drawSolarPanel(-r - panelW - 6, -panelH - 2, panelW, panelH);
      drawSolarPanel(-r - panelW - 6, 2, panelW, panelH);
      drawSolarPanel(r + 6, -panelH - 2, panelW, panelH);
      drawSolarPanel(r + 6, 2, panelW, panelH);
    } else {
      drawSolarPanel(-r - panelW - 6, -panelH / 2, panelW, panelH);
      drawSolarPanel(r + 6, -panelH / 2, panelW, panelH);
    }

    ctx.strokeStyle = '#7d8a9c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-r, 0); ctx.lineTo(-r - 6, 0);
    ctx.moveTo(r, 0); ctx.lineTo(r + 6, 0);
    ctx.stroke();

    var bodyW = r * 2.2;
    var bodyH = r * 1.4;
    var grad = ctx.createLinearGradient(-bodyW/2, -bodyH/2, bodyW/2, bodyH/2);
    grad.addColorStop(0, lighten(station.color, 0.4));
    grad.addColorStop(0.45, station.color);
    grad.addColorStop(1, station.accentColor);
    ctx.fillStyle = grad;
    roundedRect(-bodyW/2, -bodyH/2, bodyW, bodyH, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fillRect(-bodyW/2 + 6, -bodyH/2 + 3, bodyW - 12, 2);

    ctx.fillStyle = station.id === 'soyuz' ? '#baf5cd' : 'rgba(120,200,255,0.9)';
    ctx.beginPath();
    ctx.arc(-8, 0, 3, 0, Math.PI * 2);
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.arc(8, 0, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fff3d6';
    ctx.beginPath();
    ctx.arc(bodyW/2 + 5, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = station.accentColor;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.fillStyle = station.accentColor;
    ctx.beginPath();
    ctx.arc(0, -bodyH/2 - 6, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.stroke();

    ctx.strokeStyle = '#9aa7b8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -bodyH/2 - 12);
    ctx.lineTo(0, -bodyH/2 - 22);
    ctx.stroke();
    ctx.fillStyle = '#c9d4e2';
    ctx.beginPath();
    ctx.ellipse(0, -bodyH/2 - 24, 7, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    ctx.fillStyle = hexToRgba(station.color, 0.95);
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(station.name.toUpperCase(), cx, cy + r * 1.8);
  }

  function drawSolarPanel(x, y, w, h) {
    var g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, '#2b4d78');
    g.addColorStop(0.5, '#3d6ea8');
    g.addColorStop(1, '#1c3455');
    ctx.fillStyle = g;
    roundedRect(x, y, w, h, 3);
    ctx.fill();
    ctx.strokeStyle = 'rgba(160,210,255,0.7)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.strokeStyle = 'rgba(160,210,255,0.35)';
    for (var i = 1; i < 5; i++) {
      var gx = x + i * (w / 5);
      ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx, y + h); ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(x, y + h / 2); ctx.lineTo(x + w, y + h / 2);
    ctx.stroke();
  }

  // ----- Корабли -----
  function drawShip(px, py, angle, burning) {
    var glow = ctx.createRadialGradient(px, py, 2, px, py, 18);
    glow.addColorStop(0, hexToRgba(ship.color, 0.45));
    glow.addColorStop(1, hexToRgba(ship.color, 0));
    ctx.beginPath();
    ctx.arc(px, py, 18, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(angle);

    if (burning) {
      var flameLen = 16 + Math.random() * 8;
      var fg = ctx.createLinearGradient(-10, 0, -10 - flameLen, 0);
      fg.addColorStop(0, 'rgba(255,255,200,0.95)');
      fg.addColorStop(0.4, 'rgba(255,180,60,0.7)');
      fg.addColorStop(1, 'rgba(255,80,20,0)');
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.moveTo(-10, -5);
      ctx.lineTo(-10 - flameLen, 0);
      ctx.lineTo(-10, 5);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = '#4a5a72';
    ctx.beginPath();
    ctx.moveTo(-8, -5); ctx.lineTo(-12, -6); ctx.lineTo(-12, 6); ctx.lineTo(-8, 5);
    ctx.closePath();
    ctx.fill();

    if (ship.id === 'dragon') {
      var g = ctx.createLinearGradient(0, -8, 0, 8);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(1, '#aaaaaa');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(18, 0); ctx.lineTo(4, -6); ctx.lineTo(-10, -6); ctx.lineTo(-10, 6); ctx.lineTo(4, 6);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#333';
    } else if (ship.id === 'orion') {
      var g = ctx.createLinearGradient(0, -10, 0, 10);
      g.addColorStop(0, '#fceeb5');
      g.addColorStop(1, '#8b6508');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(14, 0); ctx.lineTo(8, -9); ctx.lineTo(-8, -8); ctx.lineTo(-8, 8); ctx.lineTo(8, 9);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#8b6508';
    } else {
      var g = ctx.createLinearGradient(0, -8, 0, 8);
      g.addColorStop(0, '#cfe6ff');
      g.addColorStop(0.5, ship.color);
      g.addColorStop(1, '#1f5c9c');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(16, 0); ctx.lineTo(6, -8); ctx.lineTo(-8, -7); ctx.lineTo(-8, 7); ctx.lineTo(6, 8);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    }

    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = 'rgba(220,245,255,0.9)';
    ctx.beginPath();
    ctx.arc(6, -2, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function roundedRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function hexToRgba(hex, alpha) {
    var h = hex.replace('#','');
    if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    var r = parseInt(h.substr(0,2),16);
    var g = parseInt(h.substr(2,2),16);
    var b = parseInt(h.substr(4,2),16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }
  
  function lighten(hex, k) {
    var h = hex.replace('#','');
    if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    var r = parseInt(h.substr(0,2),16);
    var g = parseInt(h.substr(2,2),16);
    var b = parseInt(h.substr(4,2),16);
    r = Math.min(255, Math.round(r + (255 - r) * k));
    g = Math.min(255, Math.round(g + (255 - g) * k));
    b = Math.min(255, Math.round(b + (255 - b) * k));
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  var tAnimation = 0;

  function draw() {
    var w = canvas.clientWidth;
    var h = canvas.clientHeight;
    tAnimation += 0.016;

    ctx.clearRect(0, 0, w, h);

    drawStars(w, h, tAnimation);
    drawGrid();

    var st = toScreen(state.stationPos.x, state.stationPos.y);

    var dx = state.ship.x - state.stationPos.x;
    var dy = state.ship.y - state.stationPos.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    var speed = Math.sqrt(state.ship.vx * state.ship.vx + state.ship.vy * state.ship.vy);
    
    var inDock = dist <= mission.dockR;
    var okSpeed = speed <= mission.maxSpeed;

    for (var g = 0; g < state.ghostTrails.length; g++) {
      var gt = state.ghostTrails[g];
      if (gt.length < 2) continue;
      ctx.beginPath();
      for (var i = 0; i < gt.length; i++) {
        var p = toScreen(gt[i].x, gt[i].y);
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.strokeStyle = 'rgba(120, 160, 220, 0.15)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    // Коридор
    if (!state.docked) {
      ctx.save();
      ctx.translate(st.x, st.y);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, mission.dockR * SCALE * 6, Math.PI * 0.7, Math.PI * 1.3);
      ctx.closePath();
      ctx.fillStyle = 'rgba(76, 217, 100, 0.05)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(76, 217, 100, 0.2)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }

    var dockStroke = 'rgba(76, 217, 100, 0.5)';
    var dockFill = null;
    if (inDock && okSpeed && !state.docked) {
      dockStroke = 'rgba(76, 217, 100, 0.95)';
      dockFill = 'rgba(76, 217, 100, 0.15)';
    } else if (inDock && !okSpeed) {
      dockStroke = 'rgba(255, 77, 77, 0.9)';
      dockFill = 'rgba(255, 77, 77, 0.12)';
    }
    if (dockFill) {
      ctx.beginPath();
      ctx.arc(st.x, st.y, mission.dockR * SCALE, 0, Math.PI * 2);
      ctx.fillStyle = dockFill;
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(st.x, st.y, mission.dockR * SCALE, 0, Math.PI * 2);
    ctx.strokeStyle = state.docked ? 'rgba(76, 217, 100, 0.95)' : dockStroke;
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([]);

    if (state.trail.length > 1) {
      ctx.beginPath();
      for (var k = 0; k < state.trail.length; k++) {
        var p2 = toScreen(state.trail[k].x, state.trail[k].y);
        if (k === 0) ctx.moveTo(p2.x, p2.y);
        else ctx.lineTo(p2.x, p2.y);
      }
      ctx.strokeStyle = 'rgba(77, 166, 255, 0.55)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    drawStation(st.x, st.y, state.stationAngle);

    var sp = toScreen(state.ship.x, state.ship.y);
    drawShip(sp.x, sp.y, state.shipAngle, state.burnTimer > 0);

    if (speed > 0.5 && !state.docked) {
      var kk = 0.6;
      ctx.beginPath();
      ctx.moveTo(sp.x, sp.y);
      ctx.lineTo(sp.x + state.ship.vx * kk, sp.y - state.ship.vy * kk);
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  function loop() {
    if (!state.running) {
      state.t += 0.016; 
      state.stationAngle += 0.01;
      state.stationPos.x += state.stationVel.x * 0.016;
      state.stationPos.y += state.stationVel.y * 0.016;
      if (state.stationPos.y < -150) state.stationVel.y = 1.5;
      if (state.stationPos.y > 150) state.stationVel.y = -1.5;
      
      if (state.docked) {
        state.ship.x = state.stationPos.x;
        state.ship.y = state.stationPos.y;
      }
      
      updateHud();
      draw();
      requestAnimationFrame(loop);
      return;
    }
    for (var i = 0; i < 2; i++) {
      if (state.running) stepPhysics();
    }
    updateHud();
    draw();
    requestAnimationFrame(loop);
  }

  // ---------- Корректировка ----------
  function nudge(dvDelta, angDelta) {
    var dv = parseFloat(sDv.value) + dvDelta;
    dv = Math.min(30, Math.max(0, dv));
    sDv.value = dv;
    var ang = parseFloat(sAng.value) + angDelta;
    while (ang > 180) ang -= 360;
    while (ang < -180) ang += 360;
    sAng.value = ang;
    syncOutputs();
  }

  function turnShip(delta) {
    if (!state.running || state.docked) return;
    state.shipAngle += delta * ship.turnSpeed;
    if (state.shipAngle > Math.PI) state.shipAngle -= Math.PI * 2;
    if (state.shipAngle < -Math.PI) state.shipAngle += Math.PI * 2;
    draw();
  }

  function holdButton(id, fn) {
    var el = document.getElementById(id);
    var timer = null;
    function start(e) { e.preventDefault(); fn(); timer = setInterval(fn, 80); }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    el.addEventListener('mousedown', start);
    el.addEventListener('touchstart', start, { passive: false });
    el.addEventListener('mouseup', stop);
    el.addEventListener('mouseleave', stop);
    el.addEventListener('touchend', stop);
    el.addEventListener('touchcancel', stop);
  }

  // ---------- Меню выборов ----------
  function renderChips() {
    var mc = document.getElementById('mission-chips');
    mc.innerHTML = '';
    MISSIONS.forEach(function (m) {
      var b = document.createElement('button');
      b.className = 'chip' + (m.id === mission.id ? ' active' : '');
      b.textContent = m.name;
      b.title = m.desc;
      b.addEventListener('click', function () {
        mission = m;
        missionNameEl.textContent = m.name;
        renderChips();
        resetRound(true);
      });
      mc.appendChild(b);
    });

    var sc = document.getElementById('station-chips');
    sc.innerHTML = '';
    STATIONS.forEach(function (s) {
      var b = document.createElement('button');
      b.className = 'chip' + (s.id === station.id ? ' active' : '');
      b.textContent = s.name;
      b.addEventListener('click', function () {
        station = s;
        stationNameEl.textContent = s.name;
        renderChips();
        draw();
      });
      sc.appendChild(b);
    });

    var shc = document.getElementById('ship-chips');
    shc.innerHTML = '';
    SHIPS.forEach(function (s) {
      var b = document.createElement('button');
      b.className = 'chip' + (s.id === ship.id ? ' active' : '');
      b.textContent = s.name;
      b.addEventListener('click', function () {
        ship = s;
        renderChips();
        draw();
      });
      shc.appendChild(b);
    });
  }

  // ---------- Обработчики ----------
  sDv.addEventListener('input', function () { syncOutputs(); });
  sAng.addEventListener('input', function () { syncOutputs(); });

  btnStart.addEventListener('click', startSim);
  btnBurn.addEventListener('click', burnNow);
  btnReset.addEventListener('click', function () {
    state.running = false;
    resetRound(true);
  });

  holdButton('btn-turn-left', function () { turnShip(0.05); });
  holdButton('btn-turn-right', function () { turnShip(-0.05); });

  window.addEventListener('keydown', function (e) {
    switch (e.key) {
      case 'ArrowLeft': nudge(0, -2); e.preventDefault(); break;
      case 'ArrowRight': nudge(0, 2); e.preventDefault(); break;
      case 'ArrowUp': nudge(1, 0); e.preventDefault(); break;
      case 'ArrowDown': nudge(-1, 0); e.preventDefault(); break;
      case 'a': case 'A': case 'ф': case 'Ф': turnShip(0.05); break;
      case 'd': case 'D': case 'в': case 'В': turnShip(-0.05); break;
      case ' ': startSim(); e.preventDefault(); break;
      case 'b': case 'B': case 'и': case 'И':
        burnNow(); e.preventDefault(); break;
      case 'r': case 'R': case 'к': case 'К':
        state.running = false; resetRound(true); break;
    }
  });

  window.addEventListener('resize', resize);

  // ---------- Инициализация ----------
  missionNameEl.textContent = mission.name;
  stationNameEl.textContent = station.name;
  renderChips();
  syncOutputs();
  resetRound(true);
  resize();
  requestAnimationFrame(loop);
})();
