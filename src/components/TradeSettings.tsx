import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { TradeSettings, Granularity } from '@/src/types';
import { TIMEFRAMES } from '@/src/types';

interface Props {
  settings: TradeSettings;
  onChange: (s: Partial<TradeSettings>) => void;
  disabled?: boolean;
}

const DURATIONS = [
  { label: '1 min', value: 60 },
  { label: '5 min', value: 300 },
  { label: '15 min', value: 900 },
  { label: '1 hr', value: 3600 },
];

const BODY_ID = 'panel-settings-body';

export function TradeSettingsPanel({ settings, onChange, disabled = false }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

  return (
    <div className="panel p-3 flex flex-col gap-3">
      <button
        type="button"
        aria-expanded={!collapsed}
        aria-controls={BODY_ID}
        onClick={() => setCollapsed(c => !c)}
        className="flex w-full items-center justify-between text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
      >
        <span>Trade Settings</span>
        {collapsed ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronUp size={14} aria-hidden="true" />}
      </button>

      <div id={BODY_ID} hidden={collapsed} className="flex flex-col gap-3">
        <div>
          <label className="label" htmlFor="ts-symbol">Symbol</label>
          <select id="ts-symbol" className="input-field" value={settings.symbol} onChange={e => onChange({ symbol: e.target.value })} disabled={disabled}>
            <option value="R_25">Volatility 25 (R_25)</option>
            <option value="R_50">Volatility 50 (R_50)</option>
            <option value="R_75">Volatility 75 (R_75)</option>
            <option value="R_100">Volatility 100 (R_100)</option>
          </select>
        </div>

        <div>
          <label className="label" htmlFor="ts-timeframe">Entry Timeframe</label>
          <select id="ts-timeframe" className="input-field" value={settings.entryGranularity} onChange={e => onChange({ entryGranularity: parseInt(e.target.value) as Granularity })} disabled={disabled}>
            {TIMEFRAMES.slice(0, 3).map(tf => (
              <option key={tf.granularity} value={tf.granularity}>{tf.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="ts-stake">Stake per Trade ($)</label>
          <input id="ts-stake" className="input-field" type="number" min="1" step="1" value={settings.stake} onChange={e => onChange({ stake: parseFloat(e.target.value) || 1 })} disabled={disabled} />
        </div>

        <div>
          <label className="label" htmlFor="ts-duration">Contract Duration</label>
          <select id="ts-duration" className="input-field" value={settings.contractDuration} onChange={e => onChange({ contractDuration: parseInt(e.target.value) })} disabled={disabled}>
            {DURATIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="ts-confidence">Confidence Threshold: {settings.confidenceThreshold}%</label>
          <input id="ts-confidence" type="range" min="50" max="95" step="5" value={settings.confidenceThreshold} onChange={e => onChange({ confidenceThreshold: parseInt(e.target.value) })} className="w-full accent-[var(--color-accent)]" disabled={disabled} />
          <div className="flex justify-between text-xs text-[var(--color-text-secondary)] mt-0.5"><span>50%</span><span>95%</span></div>
        </div>

        <div className="border-t border-[var(--color-border)] pt-3">
          <span className="label mb-2 block">Daily Limits</span>
          <div className="grid grid-cols-1 gap-2">
            <div>
              <label className="label" htmlFor="ts-max-loss">Max Loss ($)</label>
              <input id="ts-max-loss" className="input-field" type="number" min="1" value={settings.maxDailyLoss} onChange={e => onChange({ maxDailyLoss: parseFloat(e.target.value) || 10 })} disabled={disabled} />
            </div>
            <div>
              <label className="label" htmlFor="ts-profit-target">Profit Target ($)</label>
              <input id="ts-profit-target" className="input-field" type="number" min="1" value={settings.maxDailyProfit} onChange={e => onChange({ maxDailyProfit: parseFloat(e.target.value) || 10 })} disabled={disabled} />
            </div>
            <div>
              <label className="label" htmlFor="ts-max-daily">Max Daily Trades</label>
              <input id="ts-max-daily" className="input-field" type="number" min="1" max="100" value={settings.maxDailyTrades} onChange={e => onChange({ maxDailyTrades: parseInt(e.target.value) || 10 })} disabled={disabled} />
            </div>
            <div>
              <label className="label" htmlFor="ts-max-concurrent">Max Concurrent Trades</label>
              <input
                id="ts-max-concurrent"
                className="input-field"
                type="number"
                min="1"
                max="10"
                value={settings.maxConcurrentTrades}
                onChange={e => onChange({ maxConcurrentTrades: clamp(parseInt(e.target.value) || 2, 1, 10) })}
                disabled={disabled}
              />
              <p className="text-xs text-[var(--color-text-secondary)] mt-1">Maximum positions open at the same time (1-10).</p>
            </div>
          </div>
        </div>

        <div className="border-t border-[var(--color-border)] pt-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-[var(--color-text-primary)]" id="ts-autotrade-label">Auto-Trade</div>
              <div className="text-xs text-[var(--color-text-secondary)]">Enter trades automatically</div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.autoTrade}
              aria-labelledby="ts-autotrade-label"
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${settings.autoTrade ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border)]'}`}
              onClick={() => onChange({ autoTrade: !settings.autoTrade })}
              disabled={disabled}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.autoTrade ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
