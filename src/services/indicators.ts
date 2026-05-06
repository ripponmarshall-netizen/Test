import type { OHLCCandle, EMAResult, RSIResult, MACDResult, BollingerResult, IndicatorSet } from '@/src/types';

function calculateEMA(closes: number[], period: number): number[] {
  const result = new Array(closes.length).fill(NaN);
  if (closes.length < period) return result;

  let sum = 0;
  for (let i = 0; i < period; i++) sum += closes[i];
  result[period - 1] = sum / period;

  const multiplier = 2 / (period + 1);
  for (let i = period; i < closes.length; i++) {
    result[i] = (closes[i] - result[i - 1]) * multiplier + result[i - 1];
  }
  return result;
}

export function calculateEMAs(closes: number[]): EMAResult {
  return {
    ema20: calculateEMA(closes, 20),
    ema50: calculateEMA(closes, 50),
    ema200: calculateEMA(closes, 200),
  };
}

export function calculateRSI(closes: number[], period = 14): RSIResult {
  const result = new Array(closes.length).fill(NaN);
  if (closes.length < period + 1) return { values: result };

  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }
  avgGain /= period;
  avgLoss /= period;

  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  result[period] = 100 - 100 / (1 + rs);

  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    const rs2 = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result[i] = 100 - 100 / (1 + rs2);
  }

  return { values: result };
}

export function calculateMACD(
  closes: number[],
  fast = 12,
  slow = 26,
  signalPeriod = 9
): MACDResult {
  const len = closes.length;
  const macdLine = new Array(len).fill(NaN);
  const signalLine = new Array(len).fill(NaN);
  const histogram = new Array(len).fill(NaN);

  const emaFast = calculateEMA(closes, fast);
  const emaSlow = calculateEMA(closes, slow);

  const macdValues: number[] = [];
  const macdIndices: number[] = [];

  for (let i = 0; i < len; i++) {
    if (!isNaN(emaFast[i]) && !isNaN(emaSlow[i])) {
      macdLine[i] = emaFast[i] - emaSlow[i];
      macdValues.push(macdLine[i]);
      macdIndices.push(i);
    }
  }

  if (macdValues.length < signalPeriod) return { macd: macdLine, signal: signalLine, histogram };

  let sigSum = 0;
  for (let i = 0; i < signalPeriod; i++) sigSum += macdValues[i];
  const sigMult = 2 / (signalPeriod + 1);
  let sigEMA = sigSum / signalPeriod;

  signalLine[macdIndices[signalPeriod - 1]] = sigEMA;
  histogram[macdIndices[signalPeriod - 1]] = macdLine[macdIndices[signalPeriod - 1]] - sigEMA;

  for (let i = signalPeriod; i < macdValues.length; i++) {
    sigEMA = (macdValues[i] - sigEMA) * sigMult + sigEMA;
    const idx = macdIndices[i];
    signalLine[idx] = sigEMA;
    histogram[idx] = macdLine[idx] - sigEMA;
  }

  return { macd: macdLine, signal: signalLine, histogram };
}

export function calculateBollinger(closes: number[], period = 20, mult = 2): BollingerResult {
  const len = closes.length;
  const upper = new Array(len).fill(NaN);
  const middle = new Array(len).fill(NaN);
  const lower = new Array(len).fill(NaN);
  const percentB = new Array(len).fill(NaN);

  for (let i = period - 1; i < len; i++) {
    const slice = closes.slice(i - period + 1, i + 1);
    const sma = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((sum, v) => sum + (v - sma) ** 2, 0) / period;
    const stdDev = Math.sqrt(variance);

    middle[i] = sma;
    upper[i] = sma + mult * stdDev;
    lower[i] = sma - mult * stdDev;
    const range = upper[i] - lower[i];
    percentB[i] = range === 0 ? 0.5 : (closes[i] - lower[i]) / range;
  }

  return { upper, middle, lower, percentB };
}

export function calculateAllIndicators(candles: OHLCCandle[]): IndicatorSet {
  const closes = candles.map(c => c.close);
  return {
    ema: calculateEMAs(closes),
    rsi: calculateRSI(closes),
    macd: calculateMACD(closes),
    bollinger: calculateBollinger(closes),
    calculatedAt: candles[candles.length - 1]?.epoch ?? 0,
  };
}

export function getLastValid(arr: number[]): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (!isNaN(arr[i])) return arr[i];
  }
  return NaN;
}
