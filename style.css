:root {
  --bg: #0a0e1a;
  --panel: #131a2b;
  --accent: #4da6ff;
  --good: #4cd964;
  --bad: #ff4d4d;
  --warn: #ffb84d;
  --text: #e6edf7;
  --muted: #8a97ad;
  --border: #22304a;
}

* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }

html, body {
  margin: 0;
  padding: 0;
  background: var(--bg);
  color: var(--text);
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  overflow-x: hidden;
  user-select: none;
}

#app {
  max-width: 720px;
  margin: 0 auto;
  padding: 10px 12px 24px;
}

h1 {
  font-size: 1.15rem;
  margin: 6px 0 4px;
  text-align: center;
  color: var(--accent);
  letter-spacing: 0.3px;
}

.disclaimer {
  text-align: center;
  font-size: 0.72rem;
  color: var(--muted);
  margin: 0 0 10px;
  line-height: 1.3;
}

.canvas-wrap {
  position: relative;
  width: 100%;
  background: radial-gradient(circle at 70% 30%, #101a33 0%, #05070d 80%);
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
  aspect-ratio: 16 / 10;
}

canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.hud {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  justify-content: center;
  font-size: 0.75rem;
  color: var(--muted);
  padding: 10px 4px 4px;
}

.hud b {
  color: var(--text);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.fuel {
  margin-top: 6px;
  padding: 6px 4px 0;
}

.fuel-label {
  font-size: 0.72rem;
  color: var(--muted);
  text-align: center;
  margin-bottom: 4px;
}

.fuel-label b {
  color: var(--text);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.fuel-bar {
  height: 8px;
  background: #1c2740;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid var(--border);
}

.fuel-fill {
  height: 100%;
  width: 100%;
  background: linear-gradient(90deg, #4cd964 0%, #ffb84d 60%, #ff4d4d 100%);
  transition: width 0.15s linear;
}

.panel {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 10px 12px 6px;
  margin-top: 10px;
}

.panel h2 {
  font-size: 0.78rem;
  margin: 0 0 8px;
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.slider-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.slider-row label {
  flex: 0 0 78px;
  font-size: 0.75rem;
  color: var(--muted);
}

.slider-row input[type=range] {
  flex: 1;
  accent-color: var(--accent);
  height: 32px;
}

.slider-row .val {
  flex: 0 0 54px;
  text-align: right;
  font-size: 0.78rem;
  font-variant-numeric: tabular-nums;
}

.buttons {
  display: flex;
  gap: 10px;
  margin-top: 10px;
}

button {
  flex: 1;
  padding: 14px 10px;
  font-size: 0.9rem;
  font-weight: 700;
  border: none;
  border-radius: 10px;
  background: #1c2740;
  color: var(--text);
  cursor: pointer;
  touch-action: manipulation;
}

button:active { transform: scale(0.98); }
button.primary { background: var(--accent); color: #04101f; }
button:disabled { opacity: 0.45; cursor: not-allowed; }

.msg {
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  font-size: 0.82rem;
  line-height: 1.4;
  min-height: 1em;
  display: none;
}

.msg.show { display: block; }
.msg.ok {
  background: rgba(76, 217, 100, 0.12);
  border: 1px solid rgba(76, 217, 100, 0.4);
  color: #b8f0c4;
}
.msg.err {
  background: rgba(255, 77, 77, 0.12);
  border: 1px solid rgba(255, 77, 77, 0.4);
  color: #ffc2c2;
}

.hint {
  font-size: 0.7rem;
  color: var(--muted);
  text-align: center;
  line-height: 1.4;
  margin: 12px 0 0;
}

.mobile-nudge button {
  padding: 16px 10px;
  font-size: 0.85rem;
}

@media (max-width: 420px) {
  h1 { font-size: 1rem; }
  .hud { font-size: 0.7rem; }
  .slider-row label { flex: 0 0 64px; font-size: 0.7rem; }
  .slider-row .val { flex: 0 0 48px; font-size: 0.72rem; }
  button { padding: 16px 8px; font-size: 0.85rem; }
}
