import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import type { TradeSettings } from '@/src/types';
import type { TradingEngine } from '@/src/hooks/useTradingEngine';
import { calculateAllIndicators } from '@/src/services/indicators';
import { ConnectionPanel } from './ConnectionPanel';
import { TradeSettingsPanel } from './TradeSettings';
import { StatusBar } from './StatusBar';
import { Chart } from './Chart';
import { SignalPanel } from './SignalPanel';
import { TradeHistory } from './TradeHistory';

interface Props {
  engine: TradingEngine;
  settings: TradeSettings;
  onSettingsChange: (s: Partial<TradeSettings>) => void;
}

export function Dashboard({ engine, settings, onSettingsChange }: Props) {
  const {
    botStatus, currentSignal, entryCandles, tradeHistory, dailyStats,
    selectedGranularity, setSelectedGranularity, startBot, stopBot, manualTrade,
    connect, disconnect, connectionStatus, account, error, limitReason, clearHistory,
  } = engine;

  const isConnected = connectionStatus === 'authorized';
  const [drawerOpen, setDrawerOpen] = useState(false);

  const indicators = useMemo(() => {
    if (entryCandles.length < 20) return null;
    return calculateAllIndicators(entryCandles);
  }, [entryCandles]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawerOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  const handleSettingsChange = (partial: Partial<TradeSettings>) => {
    const next = { ...settings, ...partial };
    onSettingsChange(partial);
    if (partial.entryGranularity !== undefined) setSelectedGranularity(partial.entryGranularity);
    try { localStorage.setItem('deriv_bot_settings', JSON.stringify(next)); } catch { /* ignore */ }
  };

  const sidebar = (
    <>
      <ConnectionPanel status={connectionStatus} account={account} error={error} settings={settings} onConnect={connect} onDisconnect={disconnect} onSettingsChange={onSettingsChange} />
      <TradeSettingsPanel settings={settings} onChange={handleSettingsChange} disabled={!isConnected} />
    </>
  );

  return (
    <div className="flex flex-col h-screen bg-[var(--color-bg-dark)] overflow-hidden">
      <header>
        <StatusBar
          botStatus={botStatus}
          dailyStats={dailyStats}
          settings={settings}
          isConnected={isConnected}
          limitReason={limitReason}
          onStart={startBot}
          onStop={stopBot}
          onMenuClick={() => setDrawerOpen(true)}
        />
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden flex flex-col scrollbar-thin">
        <main className="flex flex-col lg:flex-row flex-1 lg:overflow-hidden gap-2 p-2 min-h-0">
          <aside className="hidden lg:flex w-56 flex-col gap-2 overflow-y-auto scrollbar-thin shrink-0" aria-label="Connection and trade settings">
            {sidebar}
          </aside>

          <div className="flex flex-col flex-1 gap-2 lg:overflow-hidden min-w-0 min-h-0">
            <div className="min-h-[280px] lg:flex-1 lg:min-h-0">
              <Chart candles={entryCandles} indicators={indicators} selectedGranularity={selectedGranularity}
                onGranularityChange={g => { setSelectedGranularity(g); handleSettingsChange({ entryGranularity: g }); }} />
            </div>
            <div className="lg:h-52 shrink-0">
              <SignalPanel signal={currentSignal} confidenceThreshold={settings.confidenceThreshold} onManualTrade={manualTrade} isConnected={isConnected} isBotRunning={botStatus === 'running'} />
            </div>
          </div>
        </main>

        <div className="px-2 pb-2 shrink-0 lg:h-48 max-lg:max-h-72 max-lg:min-h-[180px]">
          <TradeHistory trades={tradeHistory} onClear={clearHistory} />
        </div>
      </div>

      {drawerOpen && (
        <>
          <div
            className="fixed inset-0 z-30 bg-black/50 lg:hidden"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Settings drawer"
            className="fixed inset-y-0 left-0 z-40 w-72 max-w-[85vw] bg-[var(--color-bg-panel)] border-r border-[var(--color-border)] flex flex-col gap-2 p-2 overflow-y-auto scrollbar-thin lg:hidden"
          >
            <div className="flex items-center justify-between px-1 pt-1">
              <span className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Settings</span>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close settings drawer"
                className="p-1 rounded text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            {sidebar}
          </aside>
        </>
      )}
    </div>
  );
}
