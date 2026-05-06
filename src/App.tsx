import { useState, useEffect } from 'react';
import { Dashboard } from '@/src/components/Dashboard';
import { useTradingEngine } from '@/src/hooks/useTradingEngine';
import { DEFAULT_SETTINGS } from '@/src/types';
import type { TradeSettings } from '@/src/types';

function loadSettings(): TradeSettings {
  try {
    const raw = localStorage.getItem('deriv_bot_settings');
    if (raw) return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<TradeSettings>) };
  } catch {
    // ignore
  }
  return DEFAULT_SETTINGS;
}

export default function App() {
  const [settings, setSettings] = useState<TradeSettings>(loadSettings);

  const engine = useTradingEngine(settings);

  const handleSettingsChange = (partial: Partial<TradeSettings>) => {
    setSettings(prev => ({ ...prev, ...partial }));
  };

  useEffect(() => {
    if (settings.entryGranularity !== engine.selectedGranularity) {
      engine.setSelectedGranularity(settings.entryGranularity);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Dashboard
      engine={engine}
      settings={settings}
      onSettingsChange={handleSettingsChange}
    />
  );
}
