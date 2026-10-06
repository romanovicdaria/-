(function () {
  'use strict';

  // ---------- Константы ----------
  var SCALE = 1.6;
  var STATION_R = 18;
  var DOCK_R = 42;
  var DT = 0.06;
  var MAX_STEPS = 900;
  var START_X = -220;
  var START_Y = 0;
  var MAX_FUEL = 30;
  var MAX_DOCK_SPEED = 28;

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

  // ---------- Физика ----------
  function stepPhysics() {
    if (state.finished) return;

    if (!state.applied) {
      var rad = state.impulse.ang * Math.PI / 180;
      var dv = state.impulse.dv;

      // Ограничение по топливу
      if (dv > state.fuel) {
        dv = state.fuel;
      }

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

    // Притяжение станции
    var dx = 0 - state.ship.x;
    var dy = 0 - state.ship.y;
    var r2 = dx * dx + dy * dy;
    var r = Math.sqrt(r2) || 1;
    var G = 12;
    var a = G / Math.max(r2, 400);
    state.ship.vx += (dx / r) * a * DT;
    state.ship.vy += (dy / r) * a * DT;

    // Движение
    state.ship.x += state.ship.vx * DT;
    state.ship.y += state.ship.vy * DT;
    state.t += DT;
    state.step++;

    if (state.burnTimer > 0) state.burnTimer -= DT;

    state.trail.push({ x: state.ship.x, y: state.ship.y });
    if (state.trail.length > 500) state.trail.shift();

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
    if (Math.abs(state.ship.x) > 420 || Math.abs(state.ship.y) > 320) {
      finish(false, 'Аппарат ушёл за пределы зоны. Расстояние ' + dist.toFixed(1) + '.');
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

    // Солнечные панели
    var panelW = 46, panelH = 12;
    ctx.fillStyle = '#1e3a5f';
    ctx.fillRect(cx - r - panelW - 6, cy - panelH / 2, panelW, panelH);
    ctx.fillRect(cx + r + 6, cy - panelH / 2, panelW, panelH);
    // Полоски на панелях
    ctx.strokeStyle = 'rgba(120, 170, 220, 0.5)';
    ctx.lineWidth = 1;
    for (var i = 0; i < 4; i++) {
      var offX = i * (panelW / 4);
      ctx.beginPath();
      ctx.moveTo(cx - r - panelW - 6 + offX, cy - panelH / 2);
      ctx.lineTo(cx - r - panelW - 6 + offX, cy + panelH / 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + r + 6 + offX, cy - panelH / 2);
      ctx.lineTo(cx + r + 6 + offX, cy + panelH / 2);
      ctx.stroke();
    }

    // Центральный модуль (цилиндр)
    var bodyW = r * 2.2;
    var bodyH = r * 1.4;
    var grad = ctx.createLinearGradient(cx - bodyW / 2, cy - bodyH / 2, cx + bodyW / 2, cy + bodyH / 2);
    grad.addColorStop(0, '#ffd58a');
    grad.addColorStop(0.5, '#ffb84d');
    grad.addColorStop(1, '#c8842a');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect ?
      ctx.roundRect(cx - bodyW / 2, cy - bodyH / 2, bodyW, bodyH, 6) :
      ctx.rect(cx - bodyW / 2, cy - bodyH / 2, bodyW, bodyH);
    ctx.fill();

    // Блик
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(cx - bodyW / 2 + 4, cy - bodyH / 2 + 3, bodyW - 8, 3);

    // Стыковочный узел справа
    ctx.fillStyle = '#ffe1a8';
    ctx.beginPath();
    ctx.arc(cx + bodyW / 2 + 4, cy, 4, 0, Math.PI * 2);
    ctx.fill();

    // Маленький модуль сверху
    ctx.fillStyle = '#d89a3f';
    ctx.beginPath();
    ctx.arc(cx, cy - bodyH / 2 - 6, 5, 0, Math.PI * 2);
    ctx.fill();

    // Свечение
    ctx.beginPath();
    ctx.arc(cx, cy, r * 2.6, 0, Math.PI * 2);
    var g2 = ctx.createRadialGradient(cx, cy, r, cx, cy, r * 2.6);
    g2.addColorStop(0, 'rgba(255,184,77,0.28)');
    g2.addColorStop(1, 'rgba(255,184,77,0)');
    ctx.fillStyle = g2;
    ctx.fill();

    // Подпись
    ctx.fillStyle = 'rgba(255,184,77,0.9)';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('СТАНЦИЯ', cx, cy + bodyH / 2 + 22);
  }

  function drawShip(px, py, burning) {
    var angle = 0;
    // Ориентируем аппарат по вектору скорости
    if (state.ship.vx !== 0 || state.ship.vy !== 0) {
      angle = Math.atan2(-state.ship.vy, state.ship.vx);
    }

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(angle);

    // Факел двигателя
    if (burning) {
      var flameLen = 14 + Math.random() * 8;
      var flameGrad = ctx.createLinearGradient(-8, 0, -8 - flameLen, 0);
      flameGrad.addColorStop(0, 'rgba(255,255,180,0.9)');
      flameGrad.addColorStop(0.5, 'rgba(255,150,50,0.6)');
      flameGrad.addColorStop(1, 'rgba(255,80,20,0)');
      ctx.fillStyle = flameGrad;
      ctx.beginPath();
      ctx.moveTo(-8, -4);
      ctx.lineTo(-8 - flameLen, 0);
      ctx.lineTo(-8, 4);
      ctx.closePath();
      ctx.fill();
    }

    // Корпус
    var g = ctx.createLinearGradient(0, -8, 0, 8);
    g.addColorStop(0, '#a9d4ff');
    g.addColorStop(0.5, '#4da6ff');
    g.addColorStop(1, '#1f5c9c');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(6, -7);
    ctx.lineTo(-10, -6);
    ctx.lineTo(-10, 6);
    ctx.lineTo(6, 7);
    ctx.closePath();
    ctx.fill();

    // Обводка
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Кабина
    ctx.fillStyle = 'rgba(180, 230, 255, 0.9)';
    ctx.beginPath();
    ctx.arc(4, 0, 3, 0, Math.PI * 2);
    ctx.fill();

    // Антенна
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.moveTo(-10, 0);
    ctx.lineTo(-15, 0);
    ctx.stroke();

    ctx.restore();

    // Свечение вокруг аппарата
    ctx.beginPath();
    ctx.arc(px, py, 14, 0, Math.PI * 2);
    var g2 = ctx.createRadialGradient(px, py, 2, px, py, 14);
    g2.addColorStop(0, 'rgba(77,166,255,0.4)');
    g2.addColorStop(1, 'rgba(77,166,255,0)');
    ctx.fillStyle = g2;
    ctx.fill();
  }

  function draw() {
    var w = canvas.clientWidth;
    var h = canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);

    drawStars(w, h);

    var st = toScreen(0, 0);

    // Проверка условий для подсветки
    var dist = Math.sqrt(state.ship.x * state.ship.x + state.ship.y * state.ship.y);
    var speed = Math.sqrt(state.ship.vx * state.ship.vx + state.ship.vy * state.ship.vy);
    var inDock = dist <= DOCK_R;
    var okSpeed = speed <= MAX_DOCK_SPEED;
    var inCorridor = (state.ship.x < 0) && (state.ship.x > -320) && (Math.abs(state.ship.y) < 22);

    // Коридор
    var corridorLen = 320;
    var corridorHalf = 22;
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
    if (inCorridor) {
      ctx.fillStyle = 'rgba(76, 217, 100, 0.18)';
      ctx.strokeStyle = 'rgba(76, 217, 100, 0.7)';
    } else {
      ctx.fillStyle = 'rgba(76, 217, 100, 0.08)';
      ctx.strokeStyle = 'rgba(76, 217, 100, 0.3)';
    }
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
      ctx.strokeStyle = 'rgba(77, 166, 255, 0.45)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Станция и аппарат
    drawStation(st.x, st.y);

    var sp = toScreen(state.ship.x, state.ship.y);
    drawShip(sp.x, sp.y, state.burnTimer > 0);

    // Вектор скорости
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

 
