import { useState } from 'react';
import type { TradeLog } from '@/src/types';

interface Props {
  trades: TradeLog[];
  onClear: () => void;
}

function exportCSV(trades: TradeLog[]) {
  const headers = ['Time', 'Symbol', 'Direction', 'Stake', 'Entry', 'Exit', 'P&L', 'Confidence', 'Status', 'Reason'];
  const rows = trades.map(t => [
    new Date(t.timestamp).toISOString(), t.symbol, t.direction,
    t.stake.toFixed(2), t.entryPrice.toFixed(5), t.exitPrice?.toFixed(5) ?? '',
    t.pnl?.toFixed(2) ?? '', `${t.confidence}%`, t.status,
    `"${t.reason.replace(/"/g, '""')}"`,
  ]);
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `deriv_trades_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function TradeHistory({ trades, onClear }: Props) {
  const [showAll, setShowAll] = useState(false);
  const displayed = showAll ? trades : trades.slice(0, 50);

  return (
    <div className="panel flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-[var(--color-border)]">
        <span className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Trade History ({trades.length})</span>
        <div className="flex gap-2">
          {trades.length > 0 && (
            <>
              <button className="btn-primary text-xs py-1" onClick={() => exportCSV(trades)}>Export CSV</button>
              <button className="btn-danger text-xs py-1" onClick={onClear}>Clear</button>
            </>
          )}
        </div>
      </div>
      <div className="overflow-auto flex-1 scrollbar-thin">
        {trades.length === 0 ? (
          <div className="flex items-center justify-center h-20 text-xs text-[var(--color-text-secondary)]">No trades yet</div>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-[var(--color-bg-panel)]">
              <tr className="text-[var(--color-text-secondary)] border-b border-[var(--color-border)]">
                <th className="text-left p-2 font-medium">Time</th>
                <th className="text-left p-2 font-medium">Symbol</th>
                <th className="text-left p-2 font-medium">Dir</th>
                <th className="text-right p-2 font-medium">Stake</th>
                <th className="text-right p-2 font-medium">Entry</th>
                <th className="text-right p-2 font-medium">Exit</th>
                <th className="text-right p-2 font-medium">P&L</th>
                <th className="text-right p-2 font-medium">Conf</th>
                <th className="text-left p-2 font-medium">Status</th>
                <th className="text-left p-2 font-medium">Reason</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map(trade => {
                const pnlColor = trade.pnl === undefined ? 'text-[var(--color-text-secondary)]' : trade.pnl >= 0 ? 'text-green-400' : 'text-red-400';
                const statusColor = trade.status === 'won' ? 'text-green-400' : trade.status === 'lost' ? 'text-red-400' : trade.status === 'open' ? 'text-yellow-400' : 'text-[var(--color-text-secondary)]';
                return (
                  <tr key={trade.id} className="border-b border-[var(--color-border)]/50 hover:bg-white/5">
                    <td className="p-2 font-mono text-[var(--color-text-secondary)]">{new Date(trade.timestamp).toLocaleTimeString()}</td>
                    <td className="p-2 text-[var(--color-text-secondary)]">{trade.symbol}</td>
                    <td className="p-2"><span className={`px-1.5 py-0.5 rounded text-xs font-bold ${trade.direction === 'CALL' ? 'badge-call' : 'badge-put'}`}>{trade.direction}</span></td>
                    <td className="p-2 text-right font-mono text-[var(--color-text-primary)]">$ {trade.stake.toFixed(2)}</td>
                    <td className="p-2 text-right font-mono text-[var(--color-text-secondary)]">{trade.entryPrice.toFixed(4)}</td>
                    <td className="p-2 text-right font-mono text-[var(--color-text-secondary)]">{trade.exitPrice?.toFixed(4) ?? '—'}</td>
                    <td className={`p-2 text-right font-mono font-bold ${pnlColor}`}>{trade.pnl !== undefined ? `${trade.pnl >= 0 ? '+' : ''}$${trade.pnl.toFixed(2)}` : '—'}</td>
                    <td className="p-2 text-right text-[var(--color-text-secondary)]">{trade.confidence}%</td>
                    <td className={`p-2 font-medium uppercase ${statusColor}`}>{trade.status}</td>
                    <td className="p-2 text-[var(--color-text-secondary)] max-w-[200px] truncate" title={trade.reason}>{trade.reason}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {!showAll && trades.length > 50 && (
        <div className="p-2 border-t border-[var(--color-border)] text-center">
          <button className="text-xs text-[var(--color-accent)] hover:underline" onClick={() => setShowAll(true)}>Show all {trades.length} trades</button>
        </div>
      )}
    </div>
  );
}
