import { useMemo } from 'react';
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

  const indicators = useMemo(() => {
    if (entryCandles.length < 20) return null;
    return calculateAllIndicators(entryCandles);
  }, [entryCandles]);

  const handleSettingsChange = (partial: Partial<TradeSettings>) => {
    const next = { ...settings, ...partial };
    onSettingsChange(partial);
    if (partial.entryGranularity !== undefined) setSelectedGranularity(partial.entryGranularity);
    try { localStorage.setItem('deriv_bot_settings', JSON.stringify(next)); } catch { /* ignore */ }
  };

  return (
    <div className="flex flex-col h-screen bg-[var(--color-bg-dark)] overflow-hidden">
      <StatusBar botStatus={botStatus} dailyStats={dailyStats} settings={settings} isConnected={isConnected} limitReason={limitReason} onStart={startBot} onStop={stopBot} />
      <div className="flex flex-1 overflow-hidden gap-2 p-2">
        <div className="w-56 flex flex-col gap-2 overflow-y-auto scrollbar-thin shrink-0">
          <ConnectionPanel status={connectionStatus} account={account} error={error} settings={settings} onConnect={connect} onDisconnect={disconnect} onSettingsChange={onSettingsChange} />
          <TradeSettingsPanel settings={settings} onChange={handleSettingsChange} disabled={!isConnected} />
        </div>
        <div className="flex flex-col flex-1 gap-2 overflow-hidden min-w-0">
          <div className="flex-1 min-h-0">
            <Chart candles={entryCandles} indicators={indicators} selectedGranularity={selectedGranularity}
              onGranularityChange={g => { setSelectedGranularity(g); handleSettingsChange({ entryGranularity: g }); }} />
          </div>
          <div className="h-52 shrink-0">
            <SignalPanel signal={currentSignal} confidenceThreshold={settings.confidenceThreshold} onManualTrade={manualTrade} isConnected={isConnected} isBotRunning={botStatus === 'running'} />
          </div>
        </div>
      </div>
      <div className="h-48 shrink-0 px-2 pb-2">
        <TradeHistory trades={tradeHistory} onClear={clearHistory} />
      </div>
    </div>
  );
}
