import type { OHLCCandle, Signal, SignalDirection, SignalComponent } from '@/src/types';
import { calculateAllIndicators, getLastValid } from './indicators';

function analyzeHigherTF(candles: OHLCCandle[]): SignalDirection {
  if (candles.length < 50) return 'NEUTRAL';
  const indicators = calculateAllIndicators(candles);
  const lastClose = candles[candles.length - 1].close;
  const ema20 = getLastValid(indicators.ema.ema20);
  const ema50 = getLastValid(indicators.ema.ema50);
  const hist = getLastValid(indicators.macd.histogram);
  const prevHist = indicators.macd.histogram[indicators.macd.histogram.length - 2] ?? NaN;

  if (isNaN(ema20) || isNaN(ema50)) return 'NEUTRAL';

  let bullPoints = 0;
  let bearPoints = 0;

  if (lastClose > ema50) bullPoints++;
  else bearPoints++;

  if (ema20 > ema50) bullPoints++;
  else bearPoints++;

  if (!isNaN(hist)) {
    if (hist > 0) bullPoints++;
    else bearPoints++;

    if (!isNaN(prevHist) && hist > prevHist) bullPoints++;
    else if (!isNaN(prevHist) && hist < prevHist) bearPoints++;
  }

  if (bullPoints > bearPoints + 1) return 'CALL';
  if (bearPoints > bullPoints + 1) return 'PUT';
  return 'NEUTRAL';
}

function scoreComponent(
  name: string,
  direction: 'CALL' | 'PUT',
  weight: number,
  lastClose: number,
  indicators: ReturnType<typeof calculateAllIndicators>
): { call: SignalComponent; put: SignalComponent } {
  let callScore = 0;
  let putScore = 0;
  let callValue = '';
  let putValue = '';

  const len = indicators.ema.ema20.length;
  const ema20 = getLastValid(indicators.ema.ema20);
  const ema50 = getLastValid(indicators.ema.ema50);
  const ema200 = getLastValid(indicators.ema.ema200);
  const rsi = getLastValid(indicators.rsi.values);
  const hist = getLastValid(indicators.macd.histogram);
  const prevHist = indicators.macd.histogram[len - 2] ?? NaN;
  const percentB = getLastValid(indicators.bollinger.percentB);

  switch (name) {
    case 'EMA Stack': {
      let metCall = 0;
      let metPut = 0;
      if (!isNaN(ema20) && !isNaN(ema50)) {
        if (lastClose > ema20) metCall++;
        if (ema20 > ema50) metCall++;
        if (!isNaN(ema200) && ema50 > ema200) metCall++;

        if (lastClose < ema20) metPut++;
        if (ema20 < ema50) metPut++;
        if (!isNaN(ema200) && ema50 < ema200) metPut++;
      }
      const total = isNaN(ema200) ? 2 : 3;
      callScore = metCall / total;
      putScore = metPut / total;
      callValue = `EMA20: ${ema20.toFixed(4)}, EMA50: ${ema50.toFixed(4)}`;
      putValue = callValue;
      break;
    }
    case 'RSI': {
      if (!isNaN(rsi)) {
        if (rsi < 30) callScore = 1.0;
        else if (rsi < 40) callScore = 0.7;
        else if (rsi < 50) callScore = 0.3;

        if (rsi > 70) putScore = 1.0;
        else if (rsi > 60) putScore = 0.7;
        else if (rsi > 50) putScore = 0.3;

        const state = rsi < 30 ? 'Oversold' : rsi > 70 ? 'Overbought' : 'Neutral';
        callValue = putValue = `RSI: ${rsi.toFixed(1)} (${state})`;
      }
      break;
    }
    case 'MACD': {
      if (!isNaN(hist)) {
        const rising = !isNaN(prevHist) && hist > prevHist;
        const falling = !isNaN(prevHist) && hist < prevHist;

        if (hist > 0 && rising) callScore = 1.0;
        else if (hist > 0) callScore = 0.7;
        else if (rising) callScore = 0.4;

        if (hist < 0 && falling) putScore = 1.0;
        else if (hist < 0) putScore = 0.7;
        else if (falling) putScore = 0.4;

        callValue = putValue = `MACD Hist: ${hist.toFixed(4)} (${rising ? '↑' : falling ? '↓' : '→'})`;
      }
      break;
    }
    case 'Bollinger': {
      if (!isNaN(percentB)) {
        if (percentB < 0.1) callScore = 1.0;
        else if (percentB < 0.2) callScore = 0.7;
        else if (percentB < 0.35) callScore = 0.3;

        if (percentB > 0.9) putScore = 1.0;
        else if (percentB > 0.8) putScore = 0.7;
        else if (percentB > 0.65) putScore = 0.3;

        callValue = putValue = `%B: ${(percentB * 100).toFixed(1)}%`;
      }
      break;
    }
  }

  const callDir: SignalDirection = callScore > 0 ? 'CALL' : 'NEUTRAL';
  const putDir: SignalDirection = putScore > 0 ? 'PUT' : 'NEUTRAL';

  return {
    call: { name, direction: callDir, value: callValue, score: callScore, weight },
    put: { name, direction: putDir, value: putValue, score: putScore, weight },
  };
}

export function generateSignal(
  entryCandles: OHLCCandle[],
  higherTFCandles: OHLCCandle[]
): Signal {
  const timestamp = Date.now();

  if (entryCandles.length < 50) {
    return {
      direction: 'NEUTRAL',
      confidence: 0,
      components: [],
      timestamp,
      higherTFTrend: 'NEUTRAL',
      entryTFSignal: 'NEUTRAL',
      reason: 'Insufficient candle data',
    };
  }

  const higherTFTrend = analyzeHigherTF(higherTFCandles);
  const entryIndicators = calculateAllIndicators(entryCandles);
  const lastClose = entryCandles[entryCandles.length - 1].close;

  const componentDefs = [
    { name: 'EMA Stack', weight: 0.20 },
    { name: 'RSI', weight: 0.20 },
    { name: 'MACD', weight: 0.15 },
    { name: 'Bollinger', weight: 0.15 },
  ];

  let totalCallScore = 0;
  let totalPutScore = 0;
  const callComponents: SignalComponent[] = [];
  const putComponents: SignalComponent[] = [];

  for (const def of componentDefs) {
    const scored = scoreComponent(def.name, 'CALL', def.weight, lastClose, entryIndicators);
    totalCallScore += scored.call.score * def.weight;
    totalPutScore += scored.put.score * def.weight;
    callComponents.push(scored.call);
    putComponents.push(scored.put);
  }

  const htfWeight = 0.30;
  let htfCallScore = 0;
  let htfPutScore = 0;
  let htfValue = '';

  if (higherTFTrend === 'CALL') { htfCallScore = 1.0; htfValue = '1H Trend: Bullish ↑'; }
  else if (higherTFTrend === 'PUT') { htfPutScore = 1.0; htfValue = '1H Trend: Bearish ↓'; }
  else { htfCallScore = 0.5; htfPutScore = 0.5; htfValue = '1H Trend: Neutral →'; }

  totalCallScore += htfCallScore * htfWeight;
  totalPutScore += htfPutScore * htfWeight;

  const htfCallComp: SignalComponent = {
    name: 'Higher TF Trend',
    direction: higherTFTrend === 'CALL' ? 'CALL' : 'NEUTRAL',
    value: htfValue,
    score: htfCallScore,
    weight: htfWeight,
  };
  const htfPutComp: SignalComponent = {
    name: 'Higher TF Trend',
    direction: higherTFTrend === 'PUT' ? 'PUT' : 'NEUTRAL',
    value: htfValue,
    score: htfPutScore,
    weight: htfWeight,
  };

  callComponents.push(htfCallComp);
  putComponents.push(htfPutComp);

  const direction: 'CALL' | 'PUT' = totalCallScore >= totalPutScore ? 'CALL' : 'PUT';
  const components = direction === 'CALL' ? callComponents : putComponents;
  let confidence = Math.round(Math.max(totalCallScore, totalPutScore) * 100);

  if (higherTFTrend !== 'NEUTRAL' && higherTFTrend !== direction) {
    confidence = Math.min(confidence, 40);
  }

  const topComponents = [...components]
    .sort((a, b) => b.score * b.weight - a.score * a.weight)
    .slice(0, 3)
    .filter(c => c.score > 0.3)
    .map(c => c.value);

  const reason = topComponents.length > 0
    ? `${direction} signal: ${topComponents.join('; ')}`
    : `${direction} signal with ${confidence}% confidence`;

  return { direction, confidence, components, timestamp, higherTFTrend, entryTFSignal: direction, reason };
}
