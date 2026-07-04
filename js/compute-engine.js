/**
 * compute-engine.js — 技术指标计算引擎
 * 纯函数，无 DOM 依赖，无副作用。公式与 Python notebook 严格一致。
 */

/**
 * Wilder 平滑 (RSI / ATR / ADX 的标准平滑方式)
 * @param {number[]} series - 输入序列
 * @param {number} N - 平滑周期
 * @returns {Float64Array} 平滑结果
 */
export function wilderSmooth(series, N) {
  const r = new Float64Array(series.length);
  let initSum = 0, valid = 0;
  for (let i = 0; i < Math.min(N, series.length); i++) {
    if (series[i] !== undefined && !isNaN(series[i])) { initSum += series[i]; valid++; }
  }
  if (valid === 0) return r;
  const initAvg = initSum / valid;
  r[N - 1] = initAvg;
  for (let i = N; i < series.length; i++) {
    const v = (series[i] !== undefined && !isNaN(series[i])) ? series[i] : 0;
    r[i] = (r[i - 1] * (N - 1) + v) / N;
  }
  return r;
}

/**
 * 指数移动平均
 * @param {number[]} series
 * @param {number} N
 * @returns {Float64Array}
 */
export function ema(series, N) {
  const alpha = 2 / (N + 1);
  const r = new Float64Array(series.length);
  r[0] = series[0];
  for (let i = 1; i < series.length; i++) {
    r[i] = series[i] * alpha + r[i - 1] * (1 - alpha);
  }
  return r;
}

/**
 * 简单移动平均
 * @param {number[]} series
 * @param {number} N
 * @returns {Float64Array}
 */
export function sma(series, N) {
  const r = new Float64Array(series.length);
  for (let i = N - 1; i < series.length; i++) {
    let s = 0;
    for (let j = i - N + 1; j <= i; j++) s += series[j];
    r[i] = s / N;
  }
  return r;
}

/**
 * RSI — 相对强弱指标
 * @param {number[]} closes - 收盘价序列
 * @param {number} N - 周期 (默认14)
 * @returns {{ values: Float64Array, startIdx: number, avgGain: Float64Array, avgLoss: Float64Array }}
 */
export function computeRSI(closes, N = 14) {
  const gains = new Float64Array(closes.length);
  const losses = new Float64Array(closes.length);
  for (let i = 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    gains[i] = d > 0 ? d : 0;
    losses[i] = d < 0 ? -d : 0;
  }
  const avgGain = wilderSmooth(Array.from(gains), N);
  const avgLoss = wilderSmooth(Array.from(losses), N);
  const values = new Float64Array(closes.length);
  for (let i = N; i < closes.length; i++) {
    if (avgLoss[i] === 0) values[i] = 100;
    else {
      const rs = avgGain[i] / avgLoss[i];
      values[i] = 100 - 100 / (1 + rs);
    }
  }
  return { values, startIdx: N, avgGain, avgLoss };
}

/**
 * MACD — 指数平滑异同移动平均线
 * @param {number[]} closes
 * @param {number} fast - 快线周期 (默认12)
 * @param {number} slow - 慢线周期 (默认26)
 * @param {number} signal - 信号线周期 (默认9)
 * @returns {{ diff: Float64Array, dea: Float64Array, macd: Float64Array, signals: Array<{idx,type}>, startIdx: number }}
 */
export function computeMACD(closes, fast = 12, slow = 26, signal = 9) {
  const emaFast = ema(closes, fast);
  const emaSlow = ema(closes, slow);
  const diff = new Float64Array(closes.length);
  for (let i = 0; i < closes.length; i++) diff[i] = emaFast[i] - emaSlow[i];
  const dea = ema(Array.from(diff), signal);
  const macd = new Float64Array(closes.length);
  for (let i = 0; i < closes.length; i++) macd[i] = 2 * (diff[i] - dea[i]);

  const signals = [];
  const start = slow + signal;
  for (let i = start; i < closes.length; i++) {
    if (diff[i] > dea[i] && diff[i - 1] <= dea[i - 1]) signals.push({ idx: i, type: 'golden' });
    else if (diff[i] < dea[i] && diff[i - 1] >= dea[i - 1]) signals.push({ idx: i, type: 'dead' });
  }
  return { diff, dea, macd, signals, startIdx: start };
}

/**
 * BOLL — 布林带
 * @param {number[]} closes
 * @param {number} N - 周期 (默认20)
 * @param {number} K - 标准差倍数 (默认2)
 * @returns {{ mid: Float64Array, up: Float64Array, low: Float64Array, breaks: {up:number[],down:number[]}, position: Float64Array, startIdx: number }}
 */
export function computeBOLL(closes, N = 20, K = 2) {
  const mid = new Float64Array(closes.length);
  const up = new Float64Array(closes.length);
  const low = new Float64Array(closes.length);
  const breaks = { up: [], down: [] };
  for (let i = N - 1; i < closes.length; i++) {
    let sum = 0, sumSq = 0;
    for (let j = i - N + 1; j <= i; j++) { sum += closes[j]; sumSq += closes[j] * closes[j]; }
    const m = sum / N;
    const std = Math.sqrt(sumSq / N - m * m);
    mid[i] = m; up[i] = m + K * std; low[i] = m - K * std;
    if (closes[i] > up[i]) breaks.up.push(i);
    if (closes[i] < low[i]) breaks.down.push(i);
  }
  const position = new Float64Array(closes.length);
  for (let i = N - 1; i < closes.length; i++) {
    const band = up[i] - low[i];
    position[i] = band > 0 ? (closes[i] - low[i]) / band : 0.5;
  }
  return { mid, up, low, breaks, position, startIdx: N - 1 };
}

/**
 * ATR — 平均真实波幅
 * @param {number[]} highs
 * @param {number[]} lows
 * @param {number[]} closes
 * @param {number} N - 周期 (默认14)
 * @returns {{ tr: Float64Array, atr: Float64Array, atrPct: Float64Array, startIdx: number }}
 */
export function computeATR(highs, lows, closes, N = 14) {
  const tr = new Float64Array(closes.length);
  for (let i = 1; i < closes.length; i++) {
    const a = highs[i] - lows[i];
    const b = Math.abs(highs[i] - closes[i - 1]);
    const c = Math.abs(lows[i] - closes[i - 1]);
    tr[i] = Math.max(a, b, c);
  }
  const atr = wilderSmooth(Array.from(tr), N);
  const atrPct = new Float64Array(closes.length);
  for (let i = N; i < closes.length; i++) {
    atrPct[i] = closes[i] > 0 ? atr[i] / closes[i] * 100 : 0;
  }
  return { tr, atr, atrPct, startIdx: N };
}
