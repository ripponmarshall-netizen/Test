import type { Signal, ContractType } from '@/src/types';

interface Props {
  signal: Signal | null;
  confidenceThreshold: number;
  onManualTrade: (direction: ContractType) => void;
  isConnected: boolean;
  isBotRunning: boolean;
}

function ConfidenceBar({ value, threshold }: { value: number; threshold: number }) {
  const color = value >= 85 ? '#22c55e' : value >= 70 ? '#f59e0b' : value >= 50 ? '#f97316' : '#6b7280';
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-xs">
        <span className="text-[var(--color-text-secondary)]">Confidence</span>
        <span style={{ color }} className="font-bold">{value}%</span>
      </div>
      <div className="h-2 bg-[var(--color-bg-dark)] rounded-full overflow-hidden relative">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${value}%`, backgroundColor: color }} />
        <div className="absolute top-0 h-full w-0.5 bg-white/40" style={{ left: `${threshold}%` }} title={`Threshold: ${threshold}%`} />
      </div>
    </div>
  );
}

export function SignalPanel({ signal, confidenceThreshold, onManualTrade, isConnected, isBotRunning }: Props) {
  if (!signal) {
    return (
      <div className="panel p-3 flex items-center justify-center h-full">
        <p className="text-xs text-[var(--color-text-secondary)]">{isConnected ? 'Waiting for data...' : 'Connect to see signals'}</p>
      </div>
    );
  }

  const directionColor = signal.direction === 'CALL' ? 'var(--color-call)' : signal.direction === 'PUT' ? 'var(--color-put)' : 'var(--color-neutral)';
  const trendArrow = signal.higherTFTrend === 'CALL' ? '↑' : signal.higherTFTrend === 'PUT' ? '↓' : '→';
  const trendColor = signal.higherTFTrend === 'CALL' ? 'text-green-400' : signal.higherTFTrend === 'PUT' ? 'text-red-400' : 'text-gray-400';
  const aboveThreshold = signal.confidence >= confidenceThreshold;

  return (
    <div className="panel p-3 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Signal</span>
        <span className="text-xs text-[var(--color-text-secondary)]">{new Date(signal.timestamp).toLocaleTimeString()}</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-2xl font-black px-4 py-2 rounded-lg" style={{ color: directionColor, backgroundColor: `${directionColor}22`, border: `1px solid ${directionColor}66` }}>
          {signal.direction}
        </div>
        <div className="flex-1"><ConfidenceBar value={signal.confidence} threshold={confidenceThreshold} /></div>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <span className="text-[var(--color-text-secondary)]">1H Trend:</span>
        <span className={`font-bold ${trendColor}`}>{trendArrow} {signal.higherTFTrend}</span>
        {!aboveThreshold && signal.direction !== 'NEUTRAL' && <span className="ml-auto text-yellow-500">Below threshold</span>}
      </div>
      <div className="flex flex-col gap-1">
        {signal.components.map(comp => (
          <div key={comp.name} className="flex items-center gap-2 text-xs">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: comp.score > 0.6 ? directionColor : comp.score > 0.3 ? '#f59e0b' : '#4b5563' }} />
            <span className="text-[var(--color-text-secondary)] w-28 shrink-0">{comp.name}</span>
            <span className="text-[var(--color-text-primary)] flex-1 truncate">{comp.value}</span>
            <span className="shrink-0 font-mono text-[var(--color-text-secondary)]">{(comp.score * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
      {isConnected && (
        <div className="flex gap-2 pt-1 border-t border-[var(--color-border)]">
          <button className="btn-success flex-1 text-xs" onClick={() => onManualTrade('CALL')}>↑ Buy CALL</button>
          <button className="btn-danger flex-1 text-xs" onClick={() => onManualTrade('PUT')}>↓ Buy PUT</button>
        </div>
      )}
    </div>
  );
}
