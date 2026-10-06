(function () {
  'use strict';

  // ---------- Константы модели ----------
  // Единицы: 1 усл.ед. ≈ 1 м (в учебных целях), 1 усл.ед. скорости ≈ 1 м/с.
  // Движение в системе отсчёта станции, на круговой орбите.
  // Модель Хилла–Клохесси–Уилтшира (HCW):
  //   x'' = 3 n² x + 2 n y'
  //   y'' = -2 n x'
  // где x — радиальное направление (к Земле), y — трансверсальное (по движению).
  // В нашей визуализации ось X экрана — от аппарата к станции (то есть "y" в HCW),
  // ось Y экрана — "x" в HCW со знаком минус (вверх = от Земли).
  // Это даёт красивые криволинейные траектории, как у реальных кораблей.

  var SCALE = 1.6;
  var STATION_R = 18;
  var DOCK_R = 42;
  var DT = 0.05;            // шаг модельного времени, с
  var MAX_STEPS = 2400;     // ~120 с модельного времени
  var START_X = -220;
  var START_Y = 0;
  var MAX_FUEL = 30;
  var MAX_DOCK_SPEED = 22;

  // Угловая скорость орбиты. Подобрана так, чтобы за ~60–120 с
  // аппарат проходил красивые дуги. Для наглядности n довольно большое.
  var N = 0.035; // рад/с (учебное значение, больше реального)

  // ---------- DOM ----------
  var canvas = document.getElementById('scene');
  var ctx = canvas.getContext('2d');
  var msgEl = document.getElementById('msg');
  var hudDist = document.getElementById('hud-dist');
  var hudSpeed = document.getElementById('hud-speed');
  var hudTime = document.getElementById('hud-time');
  var hudDv = document.getElementById('hud-dv');
  var hudStatus = document.getElementById('hud-status');
  var fuelNum = document.getElementById('fuel-num');
  var fuelFill = document.getElementById('fuel-fill');

  var sSpeed = document.getElementById('s-speed');
  var sDir = document.getElementById('s-dir');
  var vSpeed = document.getElementById('v-speed');
  var vDir = document.getElementById('v-dir');

  var sDv = document.getElementById('s-dv');
  var sAng = document.getElementById('s-ang');
  var vDv = document.getElementById('v-dv');
  var vAng = document.getElementById('v-ang');

  var btnStart = document.getElementById('btn-start');
  var btnReset = document.getElementById('btn-reset');

  // ---------- Состояние ----------
  var state = {
    running: false,
    finished: false,
    t: 0,
    step: 0,
    // Позиция и скорость в системе станции (учебные единицы)
    ship: { x: START_X, y: START_Y, vx: 0, vy: 0 },
    impulse: { dv: 0, ang: 0 },
    applied: false,
    totalDv: 0,
    fuel: MAX_FUEL,
    burnTimer: 0,
    trail: []
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
    return { x: w / 2 + x * SCALE, y: h / 2 - y * SCALE };
  }

  // ---------- Ползунки ----------
  function syncOutputs() {
    vSpeed.textContent = parseFloat(sSpeed.value).toFixed(0);
    vDir.textContent = parseFloat(sDir.value).toFixed(0) + '°';
    vDv.textContent = parseFloat(sDv.value).toFixed(1);
    vAng.textContent = parseFloat(sAng.value).toFixed(0) + '°';
  }

  function readStartConditions() {
    var speed = parseFloat(sSpeed.value);
    var dir = parseFloat(sDir.value);
    var rad = dir * Math.PI / 180;
    return {
      x: START_X,
      y: START_Y,
      vx: speed * Math.cos(rad),
      vy: speed * Math.sin(rad)
    };
  }

  function readImpulse() {
    return {
      dv: parseFloat(sDv.value),
      ang: parseFloat(sAng.value)
    };
  }

  // ---------- Сброс ----------
  function resetRound(resetSliders) {
    state.running = false;
    state.finished = false;
    state.t = 0;
    state.step = 0;
    state.trail = [];
    state.applied = false;
    state.totalDv = 0;
    state.fuel = MAX_FUEL;
    state.burnTimer = 0;

    if (resetSliders) {
      sSpeed.value = 30;
      sDir.value = 0;
      sDv.value = 0;
      sAng.value = 0;
      syncOutputs();
    }

    var sc = readStartConditions();
    state.ship.x = sc.x;
    state.ship.y = sc.y;
    state.ship.vx = sc.vx;
    state.ship.vy = sc.vy;

    var imp = readImpulse();
    state.impulse.dv = imp.dv;
    state.impulse.ang = imp.ang;

    msgEl.className = 'msg';
    msgEl.textContent = '';
    hudStatus.textContent = 'ожидание';
    hudStatus.style.color = '';
    updateHud();
    updateFuel();
    draw();
  }

  // ---------- Старт ----------
  function startSim() {
    if (state.running) return;
    resetRound(false);
    state.running = true;
    state.finished = false;
    hudStatus.textContent = 'полёт';
    hudStatus.style.color = '#4da6ff';
    msgEl.className = 'msg';
    msgEl.textContent = '';
    requestAnimationFrame(loop);
  }

  // ---------- Физика (уравнения HCW) ----------
  function stepPhysics() {
    if (state.finished) return;

    if (!state.applied) {
      var rad = state.impulse.ang * Math.PI / 180;
      var dv = state.impulse.dv;

      if (dv > state.fuel) dv = state.fuel;

      if (dv > 0) {
        state.ship.vx += dv * Math.cos(rad);
        state.ship.vy += dv * Math.sin(rad);
        state.totalDv += dv;
        state.fuel -= dv;
        state.burnTimer = 0.4;
        if (state.fuel < 0) state.fuel = 0;
      }
      state.applied = true;
      updateFuel();
    }

    // --- HCW ---
    // Ось X экрана: от аппарата к станции = трансверсальное направление.
    // Ось Y экрана: вверх = "x" HCW.
    // В HCW: x'' = 3n²x + 2n y',  y'' = -2n x'
    // Обозначим:
    //   xC = -state.ship.y  (HCW x)
    //   yC =  state.ship.x  (HCW y)
    //   vxC = -state.ship.vy
    //   vyC =  state.ship.vx
    // Тогда ускорения в HCW:
    var n = N;
    var axC = 3 * n * n * (-state.ship.y) + 2 * n * state.ship.vx;
    var ayC = -2 * n * (-state.ship.vy);

    // Переводим ускорения обратно в экранные координаты:
    //   ax_screen =  ayC
    //   ay_screen = -axC
    var axScreen = ayC;
    var ayScreen = -axC;

    state.ship.vx += axScreen * DT;
    state.ship.vy += ayScreen * DT;

    // --- Дополнительно: слабое трение для устойчивости модели ---
    // В реальности его нет, но так траектория не "разлетается" из-за
    // больших n и крупного DT.
    state.ship.vx *= 0.9995;
    state.ship.vy *= 0.9995;

    state.ship.x += state.ship.vx * DT;
    state.ship.y += state.ship.vy * DT;
    state.t += DT;
    state.step++;

    if (state.burnTimer > 0) state.burnTimer -= DT;

    // След: ограничиваем частоту записи, чтобы след был плавным и не перегружал
    if (state.step % 2 === 0) {
      state.trail.push({ x: state.ship.x, y: state.ship.y });
      if (state.trail.length > 800) state.trail.shift();
    }

    checkResult();
  }

  function checkResult() {
    var dx = state.ship.x;
    var dy = state.ship.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    var speed = Math.sqrt(state.ship.vx * state.ship.vx + state.ship.vy * state.ship.vy);

    if (dist <= DOCK_R && speed <= MAX_DOCK_SPEED) {
      finish(true, 'Успешная стыковка. Расстояние ' + dist.toFixed(1) + ', скорость ' + speed.toFixed(1) + '.');
      return;
    }
    // Границы зоны
    if (Math.abs(state.ship.x) > 900 || Math.abs(state.ship.y) > 700) {
      finish(false, 'Аппарат ушёл за пределы зоны. Расстояние ' + dist.toFixed(1) + '.');
      return;
    }
    // Столкновение со станцией на большой скорости
    if (dist < STATION_R * 0.6) {
      finish(false, 'Столкновение со станцией! Скорость ' + speed.toFixed(1) + '.');
      return;
    }
    if (state.step >= MAX_STEPS) {
      finish(false, 'Время вышло. Расстояние ' + dist.toFixed(1) + ', скорость ' + speed.toFixed(1) + '.');
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
    updateHud();
    draw();
  }

  // ---------- HUD ----------
  function updateHud() {
    var dist = Math.sqrt(state.ship.x * state.ship.x + state.ship.y * state.ship.y);
    var speed = Math.sqrt(state.ship.vx * state.ship.vx + state.ship.vy * state.ship.vy);
    hudDist.textContent = dist.toFixed(1);
    hudSpeed.textContent = speed.toFixed(1);
    hudTime.textContent = state.t.toFixed(1);
    hudDv.textContent = state.totalDv.toFixed(1);
  }

  function updateFuel() {
    fuelNum.textContent = state.fuel.toFixed(1) + ' / ' + MAX_FUEL;
    var pct = Math.max(0, Math.min(1, state.fuel / MAX_FUEL));
    fuelFill.style.width = (pct * 100).toFixed(1) + '%';
  }

  // ---------- Отрисовка ----------
  function drawStars(w, h) {
    if (!drawStars._stars) {
      drawStars._stars = [];
      for (var i = 0; i < 110; i++) {
        drawStars._stars.push({
          x: Math.random(),
          y: Math.random(),
          r: Math.random() * 1.3 + 0.2,
          a: Math.random() * 0.6 + 0.3
        });
      }
    }
    for (var j = 0; j < drawStars._stars.length; j++) {
      var s = drawStars._stars[j];
      ctx.fillStyle = 'rgba(255,255,255,' + s.a + ')';
      ctx.beginPath();
      ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawStation(cx, cy) {
    var r = STATION_R * SCALE * 0.5;

    var glow = ctx.createRadialGradient(cx, cy, r, cx, cy, r * 3.2);
    glow.addColorStop(0, 'rgba(255,184,77,0.30)');
    glow.addColorStop(1, 'rgba(255,184,77,0)');
    ctx.beginPath();
    ctx.arc(cx, cy, r * 3.2, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    var panelW = 52, panelH = 14;
    drawSolarPanel(cx - r - panelW - 6, cy - panelH / 2, panelW, panelH);
    drawSolarPanel(cx + r + 6, cy - panelH / 2, panelW, panelH);

    ctx.strokeStyle = '#7d8a9c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - r, cy);
    ctx.lineTo(cx - r - 6, cy);
    ctx.moveTo(cx + r, cy);
    ctx.lineTo(cx + r + 6, cy);
    ctx.stroke();

    var bodyW = r * 2.2;
    var bodyH = r * 1.4;
    var grad = ctx.createLinearGradient(cx - bodyW / 2, cy - bodyH / 2, cx + bodyW / 2, cy + bodyH / 2);
    grad.addColorStop(0, '#fff0c4');
    grad.addColorStop(0.35, '#ffcf7a');
    grad.addColorStop(0.75, '#e69b36');
    grad.addColorStop(1, '#a36a1f');
    ctx.fillStyle = grad;
    roundedRect(cx - bodyW / 2, cy - bodyH / 2, bodyW, bodyH, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fillRect(cx - bodyW / 2 + 6, cy - bodyH / 2 + 3, bodyW - 12, 2);

    ctx.fillStyle = 'rgba(120,200,255,0.9)';
    ctx.beginPath();
    ctx.arc(cx - 8, cy, 3, 0, Math.PI * 2);
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.arc(cx + 8, cy, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fff3d6';
    ctx.beginPath();
    ctx.arc(cx + bodyW / 2 + 5, cy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#a36a1f';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.fillStyle = '#d89a3f';
    ctx.beginPath();
    ctx.arc(cx, cy - bodyH / 2 - 6, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.stroke();

    ctx.strokeStyle = '#9aa7b8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy - bodyH / 2 - 12);
    ctx.lineTo(cx, cy - bodyH / 2 - 22);
    ctx.stroke();
    ctx.fillStyle = '#c9d4e2';
    ctx.beginPath();
    ctx.ellipse(cx, cy - bodyH / 2 - 24, 7, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,184,77,0.95)';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('СТАНЦИЯ', cx, cy + bodyH / 2 + 24);
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
      ctx.beginPath();
      ctx.moveTo(gx, y);
      ctx.lineTo(gx, y + h);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(x, y + h / 2);
    ctx.lineTo(x + w, y + h / 2);
    ctx.stroke();
  }

  function drawShip(px, py, burning) {
    var angle = 0;
    if (state.ship.vx !== 0 || state.ship.vy !== 0) {
      angle = Math.atan2(-state.ship.vy, state.ship.vx);
    }

    var glow = ctx.createRadialGradient(px, py, 2, px, py, 18);
    glow.addColorStop(0, 'rgba(77,166,255,0.45)');
    glow.addColorStop(1, 'rgba(77,166,255,0)');
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
    ctx.moveTo(-8, -5);
    ctx.lineTo(-12, -6);
    ctx.lineTo(-12, 6);
    ctx.lineTo(-8, 5);
    ctx.closePath();
    ctx.fill();

    var g = ctx.createLinearGradient(0, -8, 0, 8);
    g.addColorStop(0, '#cfe6ff');
    g.addColorStop(0.5, '#5fb0ff');
    g.addColorStop(1, '#1f5c9c');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(6, -8);
    ctx.lineTo(-8, -7);
    ctx.lineTo(-8, 7);
    ctx.lineTo(6, 8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1;
    ctx.stroke();

    var cg = ctx.createRadialGradient(6, -2, 1, 6, -2, 5);
    cg.addColorStop(0, 'rgba(220,245,255,1)');
    cg.addColorStop(1, 'rgba(90,170,220,0.8)');
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(6, -2, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.moveTo(-8, 0);
    ctx.lineTo(14, 0);
    ctx.stroke();

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

  function draw() {
    var w = canvas.clientWidth;
    var h = canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);

    drawStars(w, h);

    var st = toScreen(0, 0);

    var dist = Math.sqrt(state.ship.x * state.ship.x + state.ship.y * state.ship.y);
    var speed = Math.sqrt(state.ship.vx * state.ship.vx + state.ship.vy * state.ship.vy);
    var inDock = dist <= DOCK_R;
    var okSpeed = speed <= MAX_DOCK_SPEED;

    // Коридор — расширенная зона сближения
    var corridorLen = 320;
    var corridorHalf = 40;
    var c1 = toScreen(-corridorLen, corridorHalf);
    var c2 = toScreen(-corridorLen, -corridorHalf);
    var c3 = toScreen(0, -corridorHalf);
    var c4 = toScreen(0, corridorHalf);
    ctx.beginPath();
    ctx.moveTo(c1.x, c1.y);
    ctx.lineTo(c2.x, c2.y);
    ctx.lineTo(c3.x, c3.y);
    ctx.lineTo(c4.x, c4.y);
    ctx.closePath();
    ctx.fillStyle = 'rgba(76, 217, 100, 0.06)';
    ctx.strokeStyle = 'rgba(76, 217, 100, 0.25)';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.stroke();

    // Радиус стыковки
    var dockStroke = 'rgba(76, 217, 100, 0.5)';
    var dockFill = null;
    if (inDock && okSpeed) {
      dockStroke = 'rgba(76, 217, 100, 0.95)';
      dockFill = 'rgba(76, 217, 100, 0.15)';
    } else if (inDock && !okSpeed) {
      dockStroke = 'rgba(255, 77, 77, 0.9)';
      dockFill = 'rgba(255, 77, 77, 0.12)';
    }
    if (dockFill) {
      ctx.beginPath();
      ctx.arc(st.x, st.y, DOCK_R * SCALE, 0, Math.PI * 2);
      ctx.fillStyle = dockFill;
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(st.x, st.y, DOCK_R * SCALE, 0, Math.PI * 2);
    ctx.strokeStyle = dockStroke;
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([]);

    // След
    if (state.trail.length > 1) {
      ctx.beginPath();
      for (var k = 0; k < state.trail.length; k++) {
        var p = toScreen(state.trail[k].x, state.trail[k].y);
        if (k === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.strokeStyle = 'rgba(77, 166, 255, 0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    drawStation(st.x, st.y);

    var sp = toScreen(state.ship.x, state.ship.y);
    drawShip(sp.x, sp.y, state.burnTimer > 0);

    if (speed > 0.5) {
      var kk = 0.6;
      ctx.beginPath();
      ctx.moveTo(sp.x, sp.y);
      ctx.lineTo(sp.x + state.ship.vx * kk, sp.y - state.ship.vy * kk);
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  // ---------- Цикл ----------
  function loop() {
    if (!state.running) return;
    for (var i = 0; i < 2; i++) {
      if (state.running) stepPhysics();
    }
    updateHud();
    draw();
    if (state.running) requestAnimationFrame(loop);
  }

  // ---------- Корректировка ----------
  function nudge(dvDelta, angDelta) {
    var dv = parseFloat(sDv.value) + dvDelta;
    dv = Math.min(30, Math.max(0, dv));
    sDv.value = dv;

    var ang = parseFloat(sAng.value) + angDelta;
    while (ang > 90) ang -= 180;
    while (ang < -90) ang += 180;
    sAng.value = ang;

    syncOutputs();
    if (state.running) {
      state.impulse.ang = ang;
    }
  }

  function holdButton(id, fn) {
    var el = document.getElementById(id);
    var timer = null;
    function start(e) {
      e.preventDefault();
      fn();
      timer = setInterval(fn, 80);
    }
    function stop() {
      if (timer) { clearInterval(timer); timer = null; }
    }
    el.addEventListener('mousedown', start);
    el.addEventListener('touchstart', start, { passive: false });
    el.addEventListener('mouseup', stop);
    el.addEventListener('mouseleave', stop);
    el.addEventListener('touchend', stop);
    el.addEventListener('touchcancel', stop);
  }

  // ---------- Обработчики ----------
  sSpeed.addEventListener('input', function () {
    syncOutputs();
    if (!state.running) resetRound(false);
  });
  sDir.addEventListener('input', function () {
    syncOutputs();
    if (!state.running) resetRound(false);
  });
  sDv.addEventListener('input', function () {
    syncOutputs();
    if (!state.running) resetRound(false);
  });
  sAng.addEventListener('input', function () {
    syncOutputs();
    if (!state.running) resetRound(false);
  });

  btnStart.addEventListener('click', startSim);
  btnReset.addEventListener('click', function () {
    state.running = false;
    resetRound(true);
  });

  holdButton('btn-left', function () { nudge(0, -2); });
  holdButton('btn-right', function () { nudge(0, 2); });
  holdButton('btn-up', function () { nudge(1, 0); });
  holdButton('btn-down', function () { nudge(-1, 0); });

  window.addEventListener('keydown', function (e) {
    switch (e.key) {
      case 'ArrowLeft': nudge(0, -2); e.preventDefault(); break;
      case 'ArrowRight': nudge(0, 2); e.preventDefault(); break;
      case 'ArrowUp': nudge(1, 0); e.preventDefault(); break;
      case 'ArrowDown': nudge(-1, 0); e.preventDefault(); break;
      case ' ': startSim(); e.preventDefault(); break;
      case 'r':
      case 'R':
      case 'к':
      case 'К':
        state.running = false;
        resetRound(true);
        break;
    }
  });

  window.addEventListener('resize', resize);

  // ---------- Старт ----------
  syncOutputs();
  resetRound(true);
  resize();
})();
