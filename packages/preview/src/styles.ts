export const EDITOR_CSS = `
:host, .wavr-ed {
  all: initial;
  font-family: "IBM Plex Sans", "Segoe UI", Helvetica, Arial, sans-serif;
  color: #f4f1ea;
  box-sizing: border-box;
}
*, *::before, *::after { box-sizing: border-box; }
.wavr-ed {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 2147483000;
}
.wavr-ed-chip,
.wavr-ed-panel {
  pointer-events: auto;
}
.wavr-ed-chip {
  position: absolute;
  right: 16px;
  bottom: 16px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 0 12px 0 8px;
  border: 1px solid rgba(255,255,255,0.16);
  border-radius: 999px;
  background: rgba(8,8,10,0.72);
  color: #fff;
  backdrop-filter: blur(16px);
  cursor: pointer;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-size: 11px;
  font-weight: 600;
}
.wavr-ed-chip:hover { background: rgba(8,8,10,0.9); }
.wavr-ed-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #7dffc3;
  box-shadow: 0 0 8px #7dffc3;
}
.wavr-ed-panel {
  position: absolute;
  top: 16px;
  right: 16px;
  width: min(320px, calc(100% - 32px));
  max-height: calc(100% - 72px);
  overflow: auto;
  padding: 16px;
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 18px;
  background: rgba(12,12,16,0.88);
  box-shadow: 0 24px 80px rgba(0,0,0,0.45);
  backdrop-filter: blur(22px);
}
.wavr-ed-panel[hidden] { display: none; }
.wavr-ed-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 14px;
}
.wavr-ed-title {
  margin: 0;
  font-size: 13px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}
.wavr-ed-sub {
  margin: 0;
  font-size: 11px;
  color: rgba(244,241,234,0.55);
}
.wavr-ed-label {
  display: block;
  margin: 12px 0 6px;
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(244,241,234,0.6);
}
.wavr-ed-presets {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  max-height: 132px;
  overflow: auto;
}
.wavr-ed-preset {
  border: 1px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.04);
  color: inherit;
  border-radius: 8px;
  padding: 7px 8px;
  font-size: 11px;
  cursor: pointer;
  text-align: left;
}
.wavr-ed-preset[data-active="true"],
.wavr-ed-preset:hover {
  border-color: rgba(125,255,195,0.7);
  background: rgba(125,255,195,0.12);
}
.wavr-ed-select,
.wavr-ed-range {
  width: 100%;
  accent-color: #7dffc3;
}
.wavr-ed-select {
  height: 32px;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.12);
  background: #111217;
  color: inherit;
  padding: 0 8px;
}
.wavr-ed-colors {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}
.wavr-ed-colors input {
  width: 100%;
  height: 36px;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}
.wavr-ed-row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 11px;
  color: rgba(244,241,234,0.7);
}
.wavr-ed-check {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}
.wavr-ed-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 16px;
}
.wavr-ed-actions button,
.wavr-ed-apply {
  height: 34px;
  border-radius: 9px;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(255,255,255,0.06);
  color: inherit;
  cursor: pointer;
  font-size: 11px;
}
.wavr-ed-apply {
  grid-column: 1 / -1;
  background: #f4f1ea;
  color: #111;
  border: 0;
  font-weight: 650;
}
.wavr-ed-status {
  min-height: 16px;
  margin-top: 8px;
  font-size: 11px;
  color: #7dffc3;
}
`;
