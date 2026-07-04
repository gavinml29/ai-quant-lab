/**
 * app.js — Stock Indicator Lab 主控制器
 * 全局状态管理、事件绑定、图表生命周期
 */
import { computeRSI, computeMACD, computeBOLL, computeATR, sma } from './compute-engine.js';

const RAW_DATA = window.RAW_DATA || [];

// ===== 全局状态 =====
const CHARTS = {};
const COLOR = {
  red:'#dc3545', green:'#28a745', orange:'#fd7e14', purple:'#6f42c1',
  cyan:'#17a2b8', blue:'#4a6cf7', gray:'#6c757d', pink:'#e377c2',
  dark:'#333', yellow:'#ffc107'
};
let _debounce = null;

// ===== 数据访问 =====
function dates() { return RAW_DATA.map(r => r[0]); }
function closes() { return RAW_DATA.map(r => r[4]); }
function highs() { return RAW_DATA.map(r => r[2]); }
function lows() { return RAW_DATA.map(r => r[3]); }

function dataSlice(arr, startIdx) {
  return Array.from(arr).slice(startIdx);
}

function labelsFor(startIdx = 0) {
  return dates().slice(startIdx);
}

// ===== Chart 工厂 =====
function makeChart(canvasId, yLabel, extra = {}) {
  const ctx = document.getElementById(canvasId).getContext('2d');
  return new Chart(ctx, {
    type: 'line',
    data: { labels: [], datasets: [] },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top', labels: { boxWidth: 12, font: { size: 10 } } },
        tooltip: { mode: 'index', intersect: false },
        zoom: {
          zoom: {
            wheel: { enabled: true },
            pinch: { enabled: true },
            mode: 'x',
          },
          pan: { enabled: true, mode: 'x' },
        }
      },
      scales: {
        x: { ticks: { maxTicksLimit: 14, font: { size: 9 } } },
        y: { title: { display: true, text: yLabel, font: { size: 10 } }, ticks: { font: { size: 9 } } }
      },
      animation: { duration: 150 },
      ...extra
    }
  });
}

// ===== RSI =====
export function updateRSI() {
  const N = +document.getElementById('rsi-n').value;
  document.getElementById('rsi-n-val').value = N;
  const { values, startIdx } = computeRSI(closes(), N);
  if (!CHARTS.rsi) CHARTS.rsi = makeChart('chart-rsi', 'RSI', { scales: { y: { min: 0, max: 100 } } });

  const labs = labelsFor(startIdx);
  CHARTS.rsi.data.labels = labs;
  CHARTS.rsi.data.datasets = [
    { label: `RSI(${N})`, data: dataSlice(values, startIdx), borderColor: COLOR.purple, borderWidth: 1.5, pointRadius: 0, tension: 0 },
    { label: '超买 70', data: Array(labs.length).fill(70), borderColor: COLOR.red, borderDash: [5,5], borderWidth: 0.8, pointRadius: 0, fill: false },
    { label: '超卖 30', data: Array(labs.length).fill(30), borderColor: COLOR.green, borderDash: [5,5], borderWidth: 0.8, pointRadius: 0, fill: false },
  ];
  CHARTS.rsi.update();

  const last = values[values.length - 1];
  const el = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  el('rsi-val', last ? last.toFixed(2) : '--');
  const dot = document.getElementById('rsi-dot'), sig = document.getElementById('rsi-sig');
  if (!dot) return;
  if (last > 70) { dot.className = 'signal-dot bull'; sig.textContent = '超买 ⚠️'; }
  else if (last < 30) { dot.className = 'signal-dot bear'; sig.textContent = '超卖 ⚠️'; }
  else if (last > 50) { dot.className = 'signal-dot bull'; sig.textContent = '偏强'; }
  else { dot.className = 'signal-dot bear'; sig.textContent = '偏弱'; }
}

// ===== MACD =====
export function updateMACD() {
  const fast = +document.getElementById('macd-fast').value;
  const slow = +document.getElementById('macd-slow').value;
  const sig = +document.getElementById('macd-signal').value;
  document.getElementById('macd-fast-val').value = fast;
  document.getElementById('macd-slow-val').value = slow;
  document.getElementById('macd-signal-val').value = sig;
  const { diff, dea, macd, signals, startIdx } = computeMACD(closes(), fast, slow, sig);
  if (!CHARTS.macd) CHARTS.macd = makeChart('chart-macd', 'MACD');

  const labs = labelsFor(startIdx);
  CHARTS.macd.data.labels = labs;
  const d = dataSlice(diff, startIdx), e = dataSlice(dea, startIdx), m = dataSlice(macd, startIdx);
  CHARTS.macd.data.datasets = [
    { label: 'MACD柱', data: m, type: 'bar', backgroundColor: m.map(v => v >= 0 ? COLOR.red : COLOR.green), borderWidth: 0 },
    { label: 'DIFF', data: d, borderColor: '#fff', borderWidth: 1, pointRadius: 0, tension: 0.1 },
    { label: 'DEA', data: e, borderColor: COLOR.yellow, borderWidth: 1, pointRadius: 0, tension: 0.1 },
  ];
  CHARTS.macd.update();

  const golden = signals.filter(s => s.type === 'golden').length;
  const dead = signals.filter(s => s.type === 'dead').length;
  document.getElementById('macd-diff').textContent = diff[diff.length - 1]?.toFixed(3) || '--';
  document.getElementById('macd-dea').textContent = dea[dea.length - 1]?.toFixed(3) || '--';
  document.getElementById('macd-golden').textContent = golden;
  document.getElementById('macd-dead').textContent = dead;
  const ld = diff[diff.length - 1], le = dea[dea.length - 1];
  const mdot = document.getElementById('macd-dot'), msig = document.getElementById('macd-sig-text');
  if (ld > le) { mdot.className = 'signal-dot bull'; msig.textContent = '多头(DIFF>DEA)'; }
  else { mdot.className = 'signal-dot bear'; msig.textContent = '空头(DIFF<DEA)'; }
}

// ===== BOLL =====
export function updateBOLL() {
  const N = +document.getElementById('boll-n').value;
  const K = +document.getElementById('boll-k').value;
  document.getElementById('boll-n-val').value = N;
  document.getElementById('boll-k-val').value = K;
  const { mid, up, low, breaks, startIdx } = computeBOLL(closes(), N, K);
  if (!CHARTS.boll) CHARTS.boll = makeChart('chart-boll', '价格（元）');

  const labs = labelsFor(startIdx);
  const showStart = Math.max(0, labs.length - 200);
  const slice = (arr) => dataSlice(arr, startIdx).slice(showStart);
  CHARTS.boll.data.labels = labs.slice(showStart);
  CHARTS.boll.data.datasets = [
    { label: `上轨 UPPER`, data: slice(up), borderColor: COLOR.pink, borderWidth: 0.8, pointRadius: 0 },
    { label: `中轨 MID`, data: slice(mid), borderColor: COLOR.cyan, borderWidth: 1, pointRadius: 0 },
    { label: `下轨 LOWER`, data: slice(low), borderColor: COLOR.pink, borderWidth: 0.8, pointRadius: 0 },
    { label: '收盘价', data: slice(closes()), borderColor: COLOR.dark, borderWidth: 1.2, pointRadius: 0 },
  ];
  CHARTS.boll.update();

  const lup = up[up.length - 1], lmid = mid[mid.length - 1], llow = low[low.length - 1];
  document.getElementById('boll-up').textContent = lup?.toFixed(2) || '--';
  document.getElementById('boll-mid').textContent = lmid?.toFixed(2) || '--';
  document.getElementById('boll-low').textContent = llow?.toFixed(2) || '--';
  document.getElementById('boll-break-up').textContent = breaks.up.length;
  document.getElementById('boll-break-down').textContent = breaks.down.length;
}

// ===== ATR =====
export function updateATR() {
  const N = +document.getElementById('atr-n').value;
  document.getElementById('atr-n-val').value = N;
  const { atr, atrPct, startIdx } = computeATR(highs(), lows(), closes(), N);
  if (!CHARTS.atr) CHARTS.atr = makeChart('chart-atr', 'ATR（元）');

  const labs = labelsFor(startIdx);
  CHARTS.atr.data.labels = labs;
  CHARTS.atr.data.datasets = [
    { label: `ATR(${N})`, data: dataSlice(atr, startIdx), borderColor: COLOR.orange, borderWidth: 1.5, pointRadius: 0, tension: 0.2, fill: true, backgroundColor: 'rgba(253,126,20,0.1)' },
  ];
  CHARTS.atr.update();

  const lA = atr[atr.length - 1], lP = atrPct[atrPct.length - 1];
  document.getElementById('atr-val').textContent = lA?.toFixed(3) || '--';
  document.getElementById('atr-pct').textContent = (lP?.toFixed(2) || '--') + '%';
  const adot = document.getElementById('atr-dot'), asig = document.getElementById('atr-sig');
  const valid = Array.from(atrPct).filter(v => v > 0);
  const avgP = valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;
  if (lP > avgP * 1.5) { adot.className = 'signal-dot bull'; asig.textContent = '高波动 ⚠️'; }
  else if (lP > avgP) { adot.className = 'signal-dot bull'; asig.textContent = '波动略高'; }
  else { adot.className = 'signal-dot bear'; asig.textContent = '波动正常'; }
}

// ===== K-Line =====
export function updateKLine() {
  const ohlc = RAW_DATA.map(r => ({
    t: luxon.DateTime.fromISO(r[0]).valueOf(),
    o: r[1], h: r[2], l: r[3], c: r[4]
  }));
  const closesArr = closes();
  const ma5 = sma(closesArr, 5);
  const ma10 = sma(closesArr, 10);
  const ma20 = sma(closesArr, 20);

  const show = ohlc.slice(-200);
  const showDates = dates().slice(-200);
  const startI = RAW_DATA.length - 200;

  if (!CHARTS.kline) {
    const ctx = document.getElementById('chart-kline').getContext('2d');
    CHARTS.kline = new Chart(ctx, {
      type: 'candlestick',
      data: { datasets: [] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { color: '#aaa', boxWidth: 12, font: { size: 10 } } },
          tooltip: { mode: 'index', intersect: false },
          zoom: {
            zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' },
            pan: { enabled: true, mode: 'x' },
          }
        },
        scales: {
          x: { ticks: { maxTicksLimit: 16, font: { size: 9 }, color: '#888' }, grid: { color: '#2a2a3e' } },
          y: { ticks: { font: { size: 9 }, color: '#888' }, grid: { color: '#2a2a3e' } }
        },
        animation: { duration: 150 }
      }
    });
  }

  CHARTS.kline.data.datasets = [
    {
      label: 'K线',
      data: show,
      color: { up: '#ff6b6b', down: '#51cf66', unchanged: '#999' },
      borderColor: { up: '#ff6b6b', down: '#51cf66' },
    },
    {
      label: 'MA5', type: 'line',
      data: showDates.map((d, i) => ({ x: luxon.DateTime.fromISO(d).valueOf(), y: ma5[startI + i] })),
      borderColor: '#feca57', borderWidth: 0.8, pointRadius: 0
    },
    {
      label: 'MA10', type: 'line',
      data: showDates.map((d, i) => ({ x: luxon.DateTime.fromISO(d).valueOf(), y: ma10[startI + i] })),
      borderColor: '#ff9ff3', borderWidth: 0.8, pointRadius: 0
    },
    {
      label: 'MA20', type: 'line',
      data: showDates.map((d, i) => ({ x: luxon.DateTime.fromISO(d).valueOf(), y: ma20[startI + i] })),
      borderColor: '#54a0ff', borderWidth: 1, pointRadius: 0
    },
  ];
  CHARTS.kline.update();

  const last = RAW_DATA[RAW_DATA.length - 1];
  const prev = RAW_DATA[RAW_DATA.length - 2];
  const chg = ((last[4] - prev[4]) / prev[4] * 100).toFixed(2);
  document.getElementById('kl-open').textContent = last[1].toFixed(2);
  document.getElementById('kl-high').textContent = last[2].toFixed(2);
  document.getElementById('kl-low').textContent = last[3].toFixed(2);
  document.getElementById('kl-close').textContent = last[4].toFixed(2);
  const chgEl = document.getElementById('kl-chg');
  chgEl.textContent = (chg > 0 ? '+' : '') + chg + '%';
  chgEl.style.color = chg >= 0 ? '#ff6b6b' : '#51cf66';
  document.getElementById('kl-ma5').textContent = ma5[ma5.length - 1]?.toFixed(2) || '--';
  document.getElementById('kl-ma10').textContent = ma10[ma10.length - 1]?.toFixed(2) || '--';
  document.getElementById('kl-ma20').textContent = ma20[ma20.length - 1]?.toFixed(2) || '--';
}

// ===== 参数变化处理 =====
export function onParamChange(indicator) {
  clearTimeout(_debounce);
  _debounce = setTimeout(() => {
    switch (indicator) {
      case 'rsi': updateRSI(); break;
      case 'macd': updateMACD(); break;
      case 'boll': updateBOLL(); break;
      case 'atr': updateATR(); break;
    }
    updateSummary();
  }, 100);
}

// ===== 综合信号 =====
export function updateSummary() {
  const N = +document.getElementById('rsi-n').value;
  const { values: rsi } = computeRSI(closes(), N);
  const lastRSI = rsi[rsi.length - 1] || 0;
  const rsiZone = lastRSI > 70 ? '超买' : lastRSI < 30 ? '超卖' : lastRSI > 50 ? '偏强' : '偏弱';

  const { diff, dea } = computeMACD(closes(), 12, 26, 9);
  const macdDir = diff[diff.length - 1] > dea[dea.length - 1] ? '偏多' : '偏空';

  const { up, low } = computeBOLL(closes(), 20, 2);
  const lastC = closes()[closes().length - 1];
  const band = up[up.length - 1] - low[low.length - 1];
  const pos = band > 0 ? (lastC - low[low.length - 1]) / band : 0.5;
  const bollZone = pos > 0.8 ? '强势' : pos > 0.5 ? '偏强' : pos > 0.2 ? '偏弱' : '弱势';

  const { atrPct } = computeATR(highs(), lows(), closes(), 14);
  const p = atrPct[atrPct.length - 1] || 0;
  const valid = Array.from(atrPct).filter(v => v > 0);
  const avgP = valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;
  const atrZone = p > avgP * 1.5 ? '高波动' : p > avgP ? '略高' : '正常';

  const bullish = (lastRSI > 50 ? 1 : 0) + (diff[diff.length - 1] > dea[dea.length - 1] ? 1 : 0) + (pos > 0.5 ? 1 : 0) + (p < avgP ? 1 : 0);

  const grid = document.getElementById('summaryGrid');
  const bgColor = bullish >= 3 ? '#e8f5e9' : bullish <= 1 ? '#fde8e8' : '#fff3e0';
  grid.innerHTML = `
    <div class="summary-card"><div class="label">RSI(${N})</div><div class="value">${lastRSI.toFixed(1)}</div><span class="tag ${lastRSI > 50 ? 'tag-red' : 'tag-green'}">${rsiZone}</span></div>
    <div class="summary-card"><div class="label">MACD</div><div class="value">${diff[diff.length - 1]?.toFixed(3) || '--'}</div><span class="tag ${diff[diff.length - 1] > dea[dea.length - 1] ? 'tag-red' : 'tag-green'}">${macdDir}</span></div>
    <div class="summary-card"><div class="label">BOLL</div><div class="value">${(pos * 100).toFixed(0)}%</div><span class="tag ${pos > 0.5 ? 'tag-red' : 'tag-yellow'}">${bollZone}</span></div>
    <div class="summary-card"><div class="label">ATR</div><div class="value">${p.toFixed(1)}%</div><span class="tag ${p > avgP * 1.5 ? 'tag-yellow' : 'tag-green'}">${atrZone}</span></div>
    <div class="summary-card" style="grid-column:1/-1;background:${bgColor}">
      <div class="label">综合判断</div>
      <div class="value">偏多 ${bullish}/4 指标</div>
    </div>`;
}

// ===== 面板控制 =====
export function togglePanel(id) {
  const body = document.getElementById('body-' + id);
  const arrow = document.getElementById('arrow-' + id);
  if (!body || !arrow) return;
  body.classList.toggle('collapsed');
  arrow.classList.toggle('collapsed-arrow');
}

export function toggleFormula(id) {
  const el = document.getElementById('formula-' + id);
  if (el) el.classList.toggle('show');
}

export function resetPanel(indicator) {
  const defaults = { rsi: 14, macd: { fast: 12, slow: 26, signal: 9 }, boll: { n: 20, k: 2 }, atr: 14 };
  if (indicator === 'macd') {
    document.getElementById('macd-fast').value = defaults.macd.fast;
    document.getElementById('macd-slow').value = defaults.macd.slow;
    document.getElementById('macd-signal').value = defaults.macd.signal;
    document.getElementById('macd-fast-val').value = defaults.macd.fast;
    document.getElementById('macd-slow-val').value = defaults.macd.slow;
    document.getElementById('macd-signal-val').value = defaults.macd.signal;
    updateMACD();
  } else if (indicator === 'boll') {
    document.getElementById('boll-n').value = defaults.boll.n;
    document.getElementById('boll-k').value = defaults.boll.k;
    document.getElementById('boll-n-val').value = defaults.boll.n;
    document.getElementById('boll-k-val').value = defaults.boll.k;
    updateBOLL();
  } else {
    document.getElementById(indicator + '-n').value = defaults[indicator];
    document.getElementById(indicator + '-n-val').value = defaults[indicator];
    if (indicator === 'rsi') updateRSI();
    else updateATR();
  }
  updateSummary();
}

export function resetAllParams() {
  resetPanel('rsi');
  resetPanel('macd');
  resetPanel('boll');
  resetPanel('atr');
}

// ===== 股票搜索 =====
export async function loadStock() {
  const input = document.getElementById('stockInput').value.trim();
  if (!input) return;
  // Currently hardcoded to 三安光电 — real implementation needs westock-data API
  document.getElementById('loadSpinner').style.display = 'inline-block';
  setTimeout(() => {
    document.getElementById('loadSpinner').style.display = 'none';
    init();
  }, 300);
}

// ===== 初始化 =====
export function init() {
  if (!RAW_DATA || RAW_DATA.length === 0) return;
  updateKLine();
  updateRSI();
  updateMACD();
  updateBOLL();
  updateATR();
  updateSummary();
  document.getElementById('dataRows').textContent = RAW_DATA.length;
  document.getElementById('dataRange').textContent = dates()[0] + ' ~ ' + dates()[dates().length - 1];
  document.getElementById('dataClose').textContent = closes()[closes().length - 1].toFixed(2);
  document.getElementById('dataStock').textContent = '三安光电 600703.SH';
}
