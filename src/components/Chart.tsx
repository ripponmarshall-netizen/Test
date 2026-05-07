import { useRef, useEffect, useCallback } from 'react';
import type { OHLCCandle, Granularity, IndicatorSet } from '@/src/types';
import { TIMEFRAMES } from '@/src/types';

interface Props {
  candles: OHLCCandle[];
  indicators: IndicatorSet | null;
  selectedGranularity: Granularity;
  onGranularityChange: (g: Granularity) => void;
}

const MAIN_HEIGHT_RATIO = 0.62;
const RSI_HEIGHT_RATIO = 0.20;
const MACD_HEIGHT_RATIO = 0.18;

function drawChart(canvas: HTMLCanvasElement, candles: OHLCCandle[], indicators: IndicatorSet | null) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(dpr, dpr);

  if (!candles.length) {
    ctx.fillStyle = '#1a1d27';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#6b7280';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Waiting for candle data...', w / 2, h / 2);
    return;
  }

  const mainH = h * MAIN_HEIGHT_RATIO;
  const rsiH = h * RSI_HEIGHT_RATIO;
  const macdH = h * MACD_HEIGHT_RATIO;
  const rsiY = mainH;
  const macdY = mainH + rsiH;

  const displayCount = Math.min(candles.length, 100);
  const visible = candles.slice(candles.length - displayCount);

  let minPrice = Infinity, maxPrice = -Infinity;
  visible.forEach(c => { if (c.low < minPrice) minPrice = c.low; if (c.high > maxPrice) maxPrice = c.high; });

  if (indicators) {
    const len = indicators.ema.ema20.length;
    const startIdx = len - displayCount;
    for (let i = Math.max(0, startIdx); i < len; i++) {
      [indicators.ema.ema20[i], indicators.ema.ema50[i], indicators.ema.ema200[i],
       indicators.bollinger.upper[i], indicators.bollinger.lower[i]].forEach(v => {
        if (!isNaN(v)) { if (v < minPrice) minPrice = v; if (v > maxPrice) maxPrice = v; }
      });
    }
  }

  const priceRange = maxPrice - minPrice;
  const pad = priceRange * 0.05;
  const pMin = minPrice - pad;
  const pMax = maxPrice + pad;
  const mapX = (i: number) => (i / (displayCount - 1)) * (w - 2) + 1;
  const mapY = (price: number) => mainH - ((price - pMin) / (pMax - pMin)) * mainH;

  ctx.fillStyle = '#0f1117'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#1a1d27'; ctx.fillRect(0, rsiY, w, rsiH);
  ctx.fillStyle = '#16192a'; ctx.fillRect(0, macdY, w, macdH);

  ctx.strokeStyle = '#2d3148'; ctx.lineWidth = 0.5;
  for (let i = 0; i <= 5; i++) {
    const y = (i / 5) * mainH;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    ctx.fillStyle = '#4b5563'; ctx.font = '9px monospace'; ctx.textAlign = 'right';
    ctx.fillText((pMax - (i / 5) * (pMax - pMin)).toFixed(2), w - 4, y - 2);
  }

  ctx.strokeStyle = '#3d4268'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, rsiY); ctx.lineTo(w, rsiY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, macdY); ctx.lineTo(w, macdY); ctx.stroke();

  if (indicators) {
    const bbLen = indicators.bollinger.upper.length;
    const bbStart = bbLen - displayCount;
    ctx.strokeStyle = 'rgba(147,51,234,0.4)'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
    for (const arr of [indicators.bollinger.upper, indicators.bollinger.lower]) {
      ctx.beginPath(); let started = false;
      for (let i = 0; i < displayCount; i++) {
        const idx = Math.max(0, bbStart) + i; if (idx >= bbLen) break;
        const v = arr[idx]; if (isNaN(v)) continue;
        const x = mapX(i); const y = mapY(v);
        if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(147,51,234,0.6)'; ctx.setLineDash([]);
    ctx.beginPath(); let bbStarted = false;
    for (let i = 0; i < displayCount; i++) {
      const idx = Math.max(0, bbStart) + i; if (idx >= bbLen) break;
      const v = indicators.bollinger.middle[idx]; if (isNaN(v)) continue;
      if (!bbStarted) { ctx.moveTo(mapX(i), mapY(v)); bbStarted = true; } else ctx.lineTo(mapX(i), mapY(v));
    }
    ctx.stroke();

    const emaLen = indicators.ema.ema20.length;
    const emaStart = emaLen - displayCount;
    for (const cfg of [
      { arr: indicators.ema.ema20, color: '#3b82f6', width: 1, dash: [] as number[] },
      { arr: indicators.ema.ema50, color: '#f97316', width: 1.5, dash: [] as number[] },
      { arr: indicators.ema.ema200, color: '#ef4444', width: 2, dash: [6, 3] },
    ]) {
      ctx.strokeStyle = cfg.color; ctx.lineWidth = cfg.width; ctx.setLineDash(cfg.dash);
      ctx.beginPath(); let started = false;
      for (let i = 0; i < displayCount; i++) {
        const idx = Math.max(0, emaStart) + i; if (idx >= emaLen) break;
        const v = cfg.arr[idx]; if (isNaN(v)) continue;
        if (!started) { ctx.moveTo(mapX(i), mapY(v)); started = true; } else ctx.lineTo(mapX(i), mapY(v));
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  const candleWidth = Math.max(1, (w / displayCount) * 0.7);
  for (let i = 0; i < visible.length; i++) {
    const c = visible[i]; const x = mapX(i);
    const isBull = c.close >= c.open;
    ctx.strokeStyle = isBull ? '#22c55e' : '#ef4444'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, mapY(c.high)); ctx.lineTo(x, mapY(c.low)); ctx.stroke();
    const bodyTop = mapY(Math.max(c.open, c.close));
    const bodyH = Math.max(1, mapY(Math.min(c.open, c.close)) - bodyTop);
    ctx.fillStyle = isBull ? 'rgba(34,197,94,0.85)' : 'rgba(239,68,68,0.85)';
    ctx.fillRect(x - candleWidth / 2, bodyTop, candleWidth, bodyH);
  }

  if (indicators) {
    const rsiLen = indicators.rsi.values.length;
    const rsiStart = rsiLen - displayCount;
    const mapRsiY = (v: number) => rsiY + rsiH - (v / 100) * rsiH;
    ctx.lineWidth = 0.5; ctx.setLineDash([3, 3]);
    ctx.strokeStyle = 'rgba(239,68,68,0.4)'; ctx.beginPath(); ctx.moveTo(0, mapRsiY(70)); ctx.lineTo(w, mapRsiY(70)); ctx.stroke();
    ctx.strokeStyle = 'rgba(34,197,94,0.4)'; ctx.beginPath(); ctx.moveTo(0, mapRsiY(30)); ctx.lineTo(w, mapRsiY(30)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#6b7280'; ctx.font = '9px monospace'; ctx.textAlign = 'left';
    ctx.fillText('RSI', 4, rsiY + 11);
    ctx.beginPath(); let rsiStarted = false;
    for (let i = 0; i < displayCount; i++) {
      const idx = Math.max(0, rsiStart) + i; if (idx >= rsiLen) break;
      const v = indicators.rsi.values[idx]; if (isNaN(v)) continue;
      const x = mapX(i); const y = mapRsiY(v);
      ctx.strokeStyle = v > 70 ? '#ef4444' : v < 30 ? '#22c55e' : '#a855f7'; ctx.lineWidth = 1.5;
      if (!rsiStarted) { ctx.moveTo(x, y); rsiStarted = true; } else { ctx.lineTo(x, y); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x, y); }
    }
  }

  if (indicators) {
    const macdLen = indicators.macd.histogram.length;
    const macdStart = macdLen - displayCount;
    const histValues: number[] = [];
    for (let i = Math.max(0, macdStart); i < macdLen; i++) { const v = indicators.macd.histogram[i]; if (!isNaN(v)) histValues.push(v); }
    if (histValues.length === 0) return;
    const maxHist = Math.max(...histValues.map(Math.abs));
    const mapMacdY = (v: number) => macdY + macdH / 2 - (v / (maxHist || 1)) * (macdH / 2 - 2);
    const zeroY = mapMacdY(0);
    ctx.strokeStyle = 'rgba(99,102,241,0.3)'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(0, zeroY); ctx.lineTo(w, zeroY); ctx.stroke();
    ctx.fillStyle = '#6b7280'; ctx.font = '9px monospace'; ctx.textAlign = 'left'; ctx.fillText('MACD', 4, macdY + 11);
    const barW = Math.max(1, (w / displayCount) * 0.7);
    for (let i = 0; i < displayCount; i++) {
      const idx = Math.max(0, macdStart) + i; if (idx >= macdLen) break;
      const v = indicators.macd.histogram[idx]; if (isNaN(v)) continue;
      const x = mapX(i);
      const yTop = v >= 0 ? mapMacdY(v) : zeroY;
      const barH = Math.max(1, Math.abs(mapMacdY(v) - zeroY));
      ctx.fillStyle = v >= 0 ? 'rgba(34,197,94,0.7)' : 'rgba(239,68,68,0.7)';
      ctx.fillRect(x - barW / 2, yTop, barW, barH);
    }
  }
}

export function Chart({ candles, indicators, selectedGranularity, onGranularityChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const redraw = useCallback(() => {
    if (canvasRef.current) drawChart(canvasRef.current, candles, indicators);
  }, [candles, indicators]);

  useEffect(() => { redraw(); }, [redraw]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => redraw());
    observer.observe(container);
    return () => observer.disconnect();
  }, [redraw]);

  return (
    <div className="panel flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--color-border)]">
        <span className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mr-2">
          {TIMEFRAMES.find(tf => tf.granularity === selectedGranularity)?.label ?? ''}
        </span>
        {TIMEFRAMES.slice(0, 3).map(tf => (
          <button key={tf.granularity} onClick={() => onGranularityChange(tf.granularity)}
            className={`text-xs px-2 py-0.5 rounded transition-colors ${
              selectedGranularity === tf.granularity ? 'bg-[var(--color-accent)] text-white' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}>
            {tf.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-3 text-xs text-[var(--color-text-secondary)]">
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-400 inline-block" />EMA20</span>
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-orange-400 inline-block" />EMA50</span>
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-red-400 inline-block" />EMA200</span>
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-purple-400 inline-block" />BB</span>
        </div>
      </div>
      <div ref={containerRef} className="flex-1 relative">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ display: 'block' }}
          role="img"
          aria-label={`Price chart at ${TIMEFRAMES.find(tf => tf.granularity === selectedGranularity)?.label ?? ''} timeframe with ${candles.length} candles`}
        />
      </div>
    </div>
  );
}
