// ===== Данные: уровни и спутники =====
const LEVELS = [
  { id: 'free', name: 'Свободный полёт', description: 'Тренировка без цели',
    distance: 220, speed: 30, fuel: 30, timeLimit: 0,
    stars: { time: 0, fuel: 0, precision: 0 },
    objective: 'Свободная тренировка' },
  { id: 'easy', name: 'Миссия 1: Первое сближение', description: 'Много топлива, медленный дрейф',
    distance: 200, speed: 20, fuel: 40, timeLimit: 0,
    stars: { time: 120, fuel: 10, precision: 5 },
    objective: 'Дистанция < 5 м, скорость < 0.5 м/с' },
  { id: 'normal', name: 'Миссия 2: V-bar подход', description: 'Стандартная стыковка по оси V',
    distance: 180, speed: 25, fuel: 30, timeLimit: 180,
    stars: { time: 150, fuel: 8, precision: 3 },
    objective: 'Подойти по V-bar, мягкий контакт' },
  { id: 'hard', name: 'Миссия 3: R-bar подход', description: 'Подход снизу, меньше топлива',
    distance: 160, speed: 28, fuel: 22, timeLimit: 150,
    stars: { time: 120, fuel: 5, precision: 2 },
    objective: 'Подойти по R-bar, удержать позицию' },
  { id: 'expert', name: 'Миссия 4: Вращающаяся станция', description: 'Станция дрейфует и вращается',
    distance: 150, speed: 30, fuel: 18, timeLimit: 120,
    stars: { time: 90, fuel: 4, precision: 1.5 },
    objective: 'Стыковка с вращающейся станцией',
    rotating: true, drift: 0.05 },
  { id: 'emergency', name: 'Миссия 5: Аварийная стыковка', description: 'Мало топлива, мало времени',
    distance: 140, speed: 35, fuel: 12, timeLimit: 90,
    stars: { time: 70, fuel: 3, precision: 1 },
    objective: 'Успеть до закрытия окна',
    rotating: true, drift: 0.08 }
];

const SATELLITES = [
  { id: 'soyuz', name: 'Союз МС', description: 'Сбалансированный корабль',
    thrust: 1.0, fuel: 1.0, agility: 1.0, color: '#7ec8ff' },
  { id: 'progress', name: 'Прогресс МС', description: 'Грузовик: много топлива, медленный',
    thrust: 0.8, fuel: 1.5, agility: 0.7, color: '#9dd68a' },
  { id: 'dragon', name: 'Crew Dragon', description: 'Быстрый, но прожорливый',
    thrust: 1.3, fuel: 0.8, agility: 1.4, color: '#ffd75e' },
  { id: 'tianzhou', name: 'Тяньчжоу', description: 'Тяжёлый, очень экономичный',
    thrust: 0.7, fuel: 1.8, agility: 0.6, color: '#ff8fa3' },
  { id: 'cygnus', name: 'Cygnus', description: 'Баланс груза и манёвра',
    thrust: 1.0, fuel: 1.2, agility: 1.0, color: '#b48aff' }
];

// ===== Состояние =====
const state = {
  level: LEVELS[0],
  satellite: SATELLITES[0],
  dist: 220, speed: 30, closing: -30,
  time: 0, dv: 0, angle: 0,
  fuel: 30, fuelMax: 30,
  running: false, impulseQueued: false,
  stars: [false, false, false],
  history: [],
  rotationPhase: 0, drift: 0,
  message: ''
};

// ===== Canvas =====
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let W = 0, H = 0;
const DPR = Math.min(window.devicePixelRatio || 1, 2);

function resize() {
  W = canvas.clientWidth;
  H = canvas.clientHeight;
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener('resize', resize);

// ===== HUD =====
const hud = {
  dist: document.getElementById('hud-dist'),
  speed: document.getElementById('hud-speed'),
  closing: document.getElementById('hud-closing'),
  time: document.getElementById('hud-time'),
  dv: document.getElementById('hud-dv'),
  fuel: document.getElementById('hud-fuel')
};

function updateHUD() {
  hud.dist.textContent = state.dist.toFixed(1);
  hud.speed.textContent = state.speed.toFixed(1);
  hud.closing.textContent = state.closing.toFixed(1);
  hud.time.textContent = state.time.toFixed(1);
  hud.dv.textContent = state.dv.toFixed(1);
  hud.fuel.textContent = state.fuel.toFixed(1) + ' / ' + state.fuelMax.toFixed(1);
}

function updateStars() {
  document.querySelectorAll('.star').forEach((el, i) => {
    el.classList.toggle('filled', !!state.stars[i]);
  });
}

function updateMissionPanel() {
  document.getElementById('mission-name').textContent = state.level.name;
  document.getElementById('objective').textContent = state.level.objective;
}

// ===== Запуск =====
function startLevel(level, satellite) {
  state.level = level;
  state.satellite = satellite;
  state.dist = level.distance;
  state.speed = level.speed;
  state.closing = -level.speed;
  state.time = 0;
  state.dv = 0;
  state.angle = 0;
  state.fuelMax = level.fuel * satellite.fuel;
  state.fuel = state.fuelMax;
  state.running = false;
  state.impulseQueued = false;
  state.stars = [false, false, false];
  state.history = [];
  state.rotationPhase = 0;
  state.drift = 0;
  state.message = '';

  updateHUD();
  updateStars();
  updateMissionPanel();
}

// ===== Физика =====
const DT = 0.1;

function physicsStep() {
  if (!state.running) return;

  if (state.level.drift) {
    state.drift += state.level.drift * DT * 0.1;
    state.dist += Math.sin(state.drift) * 0.3;
  }
  if (state.level.rotating) state.rotationPhase += 0.02;

  if (state.impulseQueued) {
    applyImpulse();
    state.impulseQueued = false;
  }

  state.dist -= state.speed * DT * 0.5;
  state.closing = -state.speed;
  state.speed *= 0.999;
  state.time += DT;

  state.history.push({ d: state.dist, s: state.speed, t: state.time });
  if (state.history.length > 400) state.history.shift();

  checkWin();

  if (state.level.timeLimit && state.time > state.level.timeLimit && !state.message) {
    state.running = false;
    state.message = 'Время вышло';
  }

  updateHUD();
}

function applyImpulse() {
  const sat = state.satellite;
  const dv = state.dv * sat.thrust;
  const rad = state.angle * Math.PI / 180;

  const forward = -Math.cos(rad) * dv;
  const lateral = Math.sin(rad) * dv;

  state.speed += forward;
  state.dist += lateral * 0.5;

  state.fuel = Math.max(0, state.fuel - Math.abs(dv) * 0.5);
  if (state.fuel <= 0 && !state.message) {
    state.running = false;
    state.message = 'Топливо закончилось';
  }
}

function checkWin() {
  const p = state.level.stars.precision || 3;
  if (state.dist < p && Math.abs(state.speed) < 0.5) {
    state.running = false;
    evaluateStars();
  }
}

function evaluateStars() {
  const lv = state.level;
  if (!lv.stars.time) {
    state.message = 'Стыковка выполнена!';
    return;
  }
  state.stars[0] = state.time <= lv.stars.time;
  state.stars[1] = (state.fuelMax - state.fuel) <= lv.stars.fuel;
  state.stars[2] = state.dist < lv.stars.precision;
  updateStars();
  const total = state.stars.filter(Boolean).length;
  state.message = 'Стыковка! Звёзд: ' + total + '/3';
}

// ===== Отрисовка =====
const bgStars = [];
for (let i = 0; i < 120; i++) {
  bgStars.push({ x: Math.random(), y: Math.random(), r: Math.random() * 1.2 });
}

function draw() {
  ctx.clearRect(0, 0, W, H);

  const cx = W / 2;
  const cy = H / 2;
  const scale = Math.min(W, H) / 500;

  // Фон — звёзды
  ctx.fillStyle = 'rgba(200, 220, 255, 0.6)';
  bgStars.forEach(s => {
    ctx.beginPath();
    ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
    ctx.fill();
  });

  // Орбита
  ctx.strokeStyle = 'rgba(80, 140, 220, 0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(cx, cy, 180 * scale, 100 * scale, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Оси
  ctx.strokeStyle = 'rgba(100, 160, 240, 0.15)';
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(cx - 200 * scale, cy); ctx.lineTo(cx + 200 * scale, cy);
  ctx.moveTo(cx, cy - 150 * scale); ctx.lineTo(cx, cy + 150 * scale);
  ctx.stroke();
  ctx.setLineDash([]);

  // Траектория
  if (state.history.length > 1) {
    ctx.strokeStyle = 'rgba(126, 200, 255, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    state.history.forEach((pt, i) => {
      const x = cx + (pt.d / 220) * 180 * scale;
      const y = cy + (pt.s / 40) * 80 * scale;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  // Коридор стыковки
  ctx.strokeStyle = 'rgba(255, 215, 94, 0.4)';
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.arc(cx, cy, (state.level.stars.precision || 5) * scale * 4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Станция
  const rot = state.level.rotating ? state.rotationPhase : 0;
  drawStation(cx, cy, 22 * scale, rot);

  // Корабль
  const shipX = cx + (state.dist / 220) * 180 * scale;
  const shipY = cy + (state.speed / 40) * 80 * scale;
  drawShip(shipX, shipY, 12 * scale, state.satellite.color);

  // Вектор скорости
  ctx.strokeStyle = '#7ec8ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(shipX, shipY);
  ctx.lineTo(shipX + 30 * scale, shipY - 10 * scale);
  ctx.stroke();

  // Сообщение
  if (state.message) {
    ctx.fillStyle = '#ffd75e';
    ctx.font = 'bold 18px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(state.message, cx, 40);
  }
}

function drawStation(x, y, r, rot) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = '#3a6ea5';
  ctx.strokeStyle = '#7ec8ff';
  ctx.lineWidth = 2;
  ctx.fillRect(-r * 2, -r * 0.3, r * 1.5, r * 0.6);
  ctx.fillRect(r * 0.5, -r * 0.3, r * 1.5, r * 0.6);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffd75e';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawShip(x, y, r, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.strokeStyle = '#e8f3ff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(-r * 0.7, -r * 0.6);
  ctx.lineTo(-r * 0.7, r * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

// ===== Игровой цикл =====
let acc = 0;
let last = performance.now();
function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  acc += dt;
  while (acc >= DT) {
    physicsStep();
    acc -= DT;
  }
  draw();
  requestAnimationFrame(loop);
}

// ===== Управление =====
document.addEventListener('keydown', (e) => {
  if (e.code === 'ArrowLeft')  state.angle = (state.angle - 5 + 360) % 360;
  if (e.code === 'ArrowRight') state.angle = (state.angle + 5) % 360;
  if (e.code === 'ArrowUp')    state.dv = Math.min(state.dv + 1, 20);
  if (e.code === 'ArrowDown')  state.dv = Math.max(state.dv - 1, 0);
  if (e.code === 'Space') { state.running = true; state.impulseQueued = true; }
  if (e.code === 'KeyB')  state.impulseQueued = true;
  if (e.code === 'KeyR')  startLevel(state.level, state.satellite);
});

document.querySelectorAll('[data-dir]').forEach(btn => {
  btn.addEventListener('click', () => {
    const d = btn.dataset.dir;
    const step = (state.satellite.agility || 1) * 10;
    if (d === 'left')  state.angle = (state.angle - step + 360) % 360;
    if (d === 'right') state.angle = (state.angle + step) % 360;
    if (d === 'up')    state.dv = Math.min(state.dv + 1, 20);
    if (d === 'down')  state.dv = Math.max(state.dv - 1, 0);
  });
});

document.getElementById('btn-impulse').addEventListener('click', () => {
  state.running = true;
  state.impulseQueued = true;
});
document.getElementById('btn-restart').addEventListener('click', () => {
  startLevel(state.level, state.satellite);
});

// ===== Модалка =====
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modal-title');
const modalBody = document.getElementById('modal-body');

function openModal(title, items, onSelect, activeId) {
  modalTitle.textContent = title;
  modalBody.innerHTML = '';
  items.forEach(item => {
    const card = document.createElement('div');
    card.className = 'card' + (item.id === activeId ? ' active' : '');
    card.innerHTML = '<h3>' + item.name + '</h3><p>' + (item.description || '') + '</p>';
    card.addEventListener('click', () => {
      onSelect(item);
      modal.classList.add('hidden');
    });
    modalBody.appendChild(card);
  });
  modal.classList.remove('hidden');
}

document.getElementById('open-missions').addEventListener('click', () => {
  openModal('Выбор миссии', LEVELS, (lv) => startLevel(lv, state.satellite), state.level.id);
});

document.getElementById('open-satellites').addEventListener('click', () => {
  openModal('Выбор спутника', SATELLITES, (sat) => {
    state.satellite = sat;
    startLevel(state.level, sat);
  }, state.satellite.id);
});

document.getElementById('modal-close').addEventListener('click', () => {
  modal.classList.add('hidden');
});

// ===== Инициализация =====
resize();
startLevel(LEVELS[0], SATELLITES[0]);
requestAnimationFrame(loop);
