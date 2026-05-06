import type { BotStatus, DailyStats, TradeSettings } from '@/src/types';

interface Props {
  botStatus: BotStatus;
  dailyStats: DailyStats;
  settings: TradeSettings;
  isConnected: boolean;
  limitReason: string | null;
  onStart: () => void;
  onStop: () => void;
}

const STATUS_CONFIG: Record<BotStatus, { label: string; color: string; bg: string }> = {
  idle: { label: 'IDLE', color: '#6b7280', bg: 'rgba(107,114,128,0.15)' },
  running: { label: 'RUNNING', color: '#22c55e', bg: 'rgba(34,197,94,0.15)' },
  stopped: { label: 'STOPPED', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
  error: { label: 'ERROR', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
  limit_reached: { label: 'LIMIT HIT', color: '#f97316', bg: 'rgba(249,115,22,0.15)' },
};

export function StatusBar({ botStatus, dailyStats, settings, isConnected, limitReason, onStart, onStop }: Props) {
  const cfg = STATUS_CONFIG[botStatus];
  const isRunning = botStatus === 'running';
  const pnlColor = dailyStats.totalPnl >= 0 ? 'var(--color-profit)' : 'var(--color-loss)';
  const pnlSign = dailyStats.totalPnl >= 0 ? '+' : '';
  const lossUsedPct = Math.min((Math.abs(Math.min(dailyStats.totalPnl, 0)) / settings.maxDailyLoss) * 100, 100);
  const profitUsedPct = Math.min((Math.max(dailyStats.totalPnl, 0) / settings.maxDailyProfit) * 100, 100);
  const tradesUsedPct = Math.min((dailyStats.tradesCount / settings.maxDailyTrades) * 100, 100);

  return (
    <div className="bg-[var(--color-bg-panel)] border-b border-[var(--color-border)] px-4 py-2 flex items-center gap-4 flex-wrap">
      <div className="flex items-center gap-2">
        <div className="px-2 py-0.5 rounded text-xs font-bold" style={{ color: cfg.color, backgroundColor: cfg.bg }}>{cfg.label}</div>
        {limitReason && <span className="text-xs text-orange-400 hidden sm:block">{limitReason}</span>}
      </div>
      <button className={isRunning ? 'btn-danger' : 'btn-success'} onClick={isRunning ? onStop : onStart} disabled={!isConnected}>
        {isRunning ? '⏹ Stop Bot' : '▶ Start Bot'}
      </button>
      <div className="h-6 w-px bg-[var(--color-border)] hidden sm:block" />
      <div className="flex items-center gap-4 text-xs">
        <div><span className="text-[var(--color-text-secondary)]">P&L: </span><span className="font-bold" style={{ color: pnlColor }}>{pnlSign}${dailyStats.totalPnl.toFixed(2)}</span></div>
        <div><span className="text-[var(--color-text-secondary)]">Trades: </span><span className="font-bold text-[var(--color-text-primary)]">{dailyStats.tradesCount}/{settings.maxDailyTrades}</span></div>
        <div>
          <span className="text-[var(--color-text-secondary)]">W/L: </span>
          <span className="text-green-400 font-bold">{dailyStats.wins}</span>
          <span className="text-[var(--color-text-secondary)]">/</span>
          <span className="text-red-400 font-bold">{dailyStats.losses}</span>
        </div>
        {dailyStats.openTrades > 0 && <div><span className="text-[var(--color-text-secondary)]">Open: </span><span className="font-bold text-yellow-400">{dailyStats.openTrades}</span></div>}
      </div>
      <div className="flex items-center gap-3 ml-auto hidden md:flex">
        <LimitBar label="Loss" pct={lossUsedPct} color="#ef4444" value={`$${Math.abs(Math.min(dailyStats.totalPnl, 0)).toFixed(0)}/$${settings.maxDailyLoss}`} />
        <LimitBar label="Profit" pct={profitUsedPct} color="#22c55e" value={`$${Math.max(dailyStats.totalPnl, 0).toFixed(0)}/$${settings.maxDailyProfit}`} />
        <LimitBar label="Trades" pct={tradesUsedPct} color="#6366f1" value={`${dailyStats.tradesCount}/${settings.maxDailyTrades}`} />
      </div>
    </div>
  );
}

function LimitBar({ label, pct, color, value }: { label: string; pct: number; color: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 min-w-[80px]">
      <div className="flex justify-between text-xs">
        <span className="text-[var(--color-text-secondary)]">{label}</span>
        <span className="text-[var(--color-text-secondary)]">{value}</span>
      </div>
      <div className="h-1 bg-[var(--color-bg-dark)] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color, opacity: pct >= 90 ? 1 : 0.6 }} />
      </div>
    </div>
  );
}
