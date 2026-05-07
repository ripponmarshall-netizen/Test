import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { Signal, ContractType } from '@/src/types';

interface Props {
  signal: Signal | null;
  confidenceThreshold: number;
  onManualTrade: (direction: ContractType) => void;
  isConnected: boolean;
  isBotRunning: boolean;
}

const BODY_ID = 'panel-signal-body';

function ConfidenceBar({ value, threshold }: { value: number; threshold: number }) {
  const color = value >= 85 ? '#22c55e' : value >= 70 ? '#f59e0b' : value >= 50 ? '#f97316' : '#6b7280';
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-xs">
        <span className="text-[var(--color-text-secondary)]">Confidence</span>
        <span style={{ color }} className="font-bold">{value}%</span>
      </div>
      <div
        className="h-2 bg-[var(--color-bg-dark)] rounded-full overflow-hidden relative"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Signal confidence ${value}%, threshold ${threshold}%`}
      >
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${value}%`, backgroundColor: color }} />
        <div className="absolute top-0 h-full w-0.5 bg-white/40" style={{ left: `${threshold}%` }} title={`Threshold: ${threshold}%`} />
      </div>
    </div>
  );
}

export function SignalPanel({ signal, confidenceThreshold, onManualTrade, isConnected, isBotRunning: _isBotRunning }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  const header = (
    <button
      type="button"
      aria-expanded={!collapsed}
      aria-controls={BODY_ID}
      onClick={() => setCollapsed(c => !c)}
      className="flex w-full items-center justify-between rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
    >
      <span className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Signal</span>
      <span className="flex items-center gap-2">
        {signal && <span className="text-xs text-[var(--color-text-secondary)]">{new Date(signal.timestamp).toLocaleTimeString()}</span>}
        {collapsed ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronUp size={14} aria-hidden="true" />}
      </span>
    </button>
  );

  if (!signal) {
    return (
      <div className="panel p-3 flex flex-col gap-3 h-full">
        {header}
        <div id={BODY_ID} hidden={collapsed} className="flex items-center justify-center flex-1">
          <p className="text-xs text-[var(--color-text-secondary)]">{isConnected ? 'Waiting for data...' : 'Connect to see signals'}</p>
        </div>
      </div>
    );
  }

  const directionColor = signal.direction === 'CALL' ? 'var(--color-call)' : signal.direction === 'PUT' ? 'var(--color-put)' : 'var(--color-neutral)';
  const trendArrow = signal.higherTFTrend === 'CALL' ? '↑' : signal.higherTFTrend === 'PUT' ? '↓' : '→';
  const trendColor = signal.higherTFTrend === 'CALL' ? 'text-green-400' : signal.higherTFTrend === 'PUT' ? 'text-red-400' : 'text-gray-400';
  const aboveThreshold = signal.confidence >= confidenceThreshold;

  return (
    <div className="panel p-3 flex flex-col gap-3 h-full">
      {header}
      <div id={BODY_ID} hidden={collapsed} className="flex flex-col gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="text-2xl font-black px-4 py-2 rounded-lg" style={{ color: directionColor, backgroundColor: `${directionColor}22`, border: `1px solid ${directionColor}66` }}>
            {signal.direction}
          </div>
          <div className="flex-1 min-w-[140px]"><ConfidenceBar value={signal.confidence} threshold={confidenceThreshold} /></div>
        </div>
        <div className="flex items-center gap-2 text-xs flex-wrap">
          <span className="text-[var(--color-text-secondary)]">1H Trend:</span>
          <span className={`font-bold ${trendColor}`}><span aria-hidden="true">{trendArrow}</span> {signal.higherTFTrend}</span>
          {!aboveThreshold && signal.direction !== 'NEUTRAL' && <span className="ml-auto text-yellow-500">Below threshold</span>}
        </div>
        <div className="flex flex-col gap-1">
          {signal.components.map(comp => (
            <div key={comp.name} className="flex items-center gap-2 text-xs">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: comp.score > 0.6 ? directionColor : comp.score > 0.3 ? '#f59e0b' : '#4b5563' }} aria-hidden="true" />
              <span className="text-[var(--color-text-secondary)] w-28 shrink-0">{comp.name}</span>
              <span className="text-[var(--color-text-primary)] flex-1 truncate">{comp.value}</span>
              <span className="shrink-0 font-mono text-[var(--color-text-secondary)]">{(comp.score * 100).toFixed(0)}%</span>
            </div>
          ))}
        </div>
        {isConnected && (
          <div className="flex gap-2 pt-1 border-t border-[var(--color-border)]">
            <button className="btn-success flex-1 text-xs" onClick={() => onManualTrade('CALL')} aria-label="Buy CALL">↑ Buy CALL</button>
            <button className="btn-danger flex-1 text-xs" onClick={() => onManualTrade('PUT')} aria-label="Buy PUT">↓ Buy PUT</button>
          </div>
        )}
      </div>
    </div>
  );
}
