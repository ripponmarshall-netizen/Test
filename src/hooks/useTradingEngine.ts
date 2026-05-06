import { useState, useEffect, useRef, useCallback } from 'react';
import type {
  OHLCCandle,
  Signal,
  TradeLog,
  DailyStats,
  BotStatus,
  TradeSettings,
  Granularity,
  ContractType,
  ConnectionStatus,
  AccountInfo,
} from '@/src/types';
import { DerivApiClient } from '@/src/services/derivApi';
import { calculateAllIndicators } from '@/src/services/indicators';
import { generateSignal } from '@/src/services/signalEngine';
import { TradeManager } from '@/src/services/tradeManager';

const HIGHER_TF: Granularity = 3600;
const CANDLE_COUNT = 250;
const MAX_CANDLES = 500;

function mergeCandle(arr: OHLCCandle[], incoming: OHLCCandle): OHLCCandle[] {
  const next = [...arr];
  if (next.length && next[next.length - 1].epoch === incoming.epoch) {
    next[next.length - 1] = incoming;
  } else {
    next.push(incoming);
    if (next.length > MAX_CANDLES) next.shift();
  }
  return next;
}

export interface TradingEngine {
  botStatus: BotStatus;
  currentSignal: Signal | null;
  entryCandles: OHLCCandle[];
  higherTFCandles: OHLCCandle[];
  tradeHistory: TradeLog[];
  dailyStats: DailyStats;
  selectedGranularity: Granularity;
  setSelectedGranularity: (g: Granularity) => void;
  startBot: () => void;
  stopBot: () => void;
  manualTrade: (direction: ContractType) => void;
  connect: (appId: string, token: string) => Promise<void>;
  disconnect: () => void;
  connectionStatus: ConnectionStatus;
  account: AccountInfo | null;
  error: string | null;
  limitReason: string | null;
  clearHistory: () => void;
}

export function useTradingEngine(settings: TradeSettings): TradingEngine {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [botStatus, setBotStatus] = useState<BotStatus>('idle');
  const [currentSignal, setCurrentSignal] = useState<Signal | null>(null);
  const [entryCandles, setEntryCandles] = useState<OHLCCandle[]>([]);
  const [higherTFCandles, setHigherTFCandles] = useState<OHLCCandle[]>([]);
  const [tradeHistory, setTradeHistory] = useState<TradeLog[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyStats>({
    tradesCount: 0, totalPnl: 0, wins: 0, losses: 0, openTrades: 0,
  });
  const [selectedGranularity, setSelectedGranularity] = useState<Granularity>(settings.entryGranularity);
  const [limitReason, setLimitReason] = useState<string | null>(null);

  const apiRef = useRef<DerivApiClient | null>(null);
  const managerRef = useRef<TradeManager | null>(null);
  const settingsRef = useRef(settings);
  const lastEntryEpochRef = useRef<number>(0);
  const lastHigherEpochRef = useRef<number>(0);
  const botStatusRef = useRef<BotStatus>('idle');
  const isTradingRef = useRef(false);

  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { botStatusRef.current = botStatus; }, [botStatus]);

  const refreshStats = useCallback(() => {
    if (!managerRef.current) return;
    setTradeHistory(managerRef.current.getAllTrades());
    setDailyStats(managerRef.current.getDailyStats());
  }, []);

  const setupSubscriptions = useCallback((api: DerivApiClient, granularity: Granularity) => {
    api.subscribeToCandles(settingsRef.current.symbol, granularity, CANDLE_COUNT);
    if (granularity !== HIGHER_TF) {
      api.subscribeToCandles(settingsRef.current.symbol, HIGHER_TF, CANDLE_COUNT);
    }

    const handleEntryCandles = (candles: unknown) => {
      const parsed = candles as OHLCCandle[];
      setEntryCandles(parsed);
      lastEntryEpochRef.current = parsed[parsed.length - 1]?.epoch ?? 0;
    };

    const handleHigherCandles = (candles: unknown) => {
      const parsed = candles as OHLCCandle[];
      if (granularity === HIGHER_TF) {
        setEntryCandles(parsed);
        lastEntryEpochRef.current = parsed[parsed.length - 1]?.epoch ?? 0;
      }
      setHigherTFCandles(parsed);
      lastHigherEpochRef.current = parsed[parsed.length - 1]?.epoch ?? 0;
    };

    api.on(`candles_${granularity}`, handleEntryCandles as (...args: unknown[]) => void);
    api.on(`candles_${HIGHER_TF}`, handleHigherCandles as (...args: unknown[]) => void);

    const handleOHLC = (ohlcData: unknown) => {
      const ohlc = ohlcData as { epoch: string; open: string; high: string; low: string; close: string; granularity: number };
      const candle: OHLCCandle = {
        epoch: parseInt(ohlc.epoch),
        open: parseFloat(ohlc.open),
        high: parseFloat(ohlc.high),
        low: parseFloat(ohlc.low),
        close: parseFloat(ohlc.close),
      };
      if (ohlc.granularity === granularity) {
        setEntryCandles(prev => {
          const next = mergeCandle(prev, candle);
          lastEntryEpochRef.current = next[next.length - 1]?.epoch ?? 0;
          return next;
        });
      } else if (ohlc.granularity === HIGHER_TF) {
        setHigherTFCandles(prev => mergeCandle(prev, candle));
      }
    };

    api.on('ohlc', handleOHLC as (...args: unknown[]) => void);

    return () => {
      api.removeAllListeners(`candles_${granularity}`);
      api.removeAllListeners(`candles_${HIGHER_TF}`);
      api.off('ohlc', handleOHLC as (...args: unknown[]) => void);
      api.forgetAllSubscriptions();
    };
  }, []);

  const connect = useCallback(async (appId: string, token: string): Promise<void> => {
    if (apiRef.current) {
      apiRef.current.disconnect();
      managerRef.current?.destroy();
    }
    const api = new DerivApiClient();
    apiRef.current = api;

    api.on('status', (s: unknown) => {
      setConnectionStatus(s as ConnectionStatus);
      if (s === 'error') setError('Connection error. Reconnecting...');
      else setError(null);
      if (s === 'authorized') {
        const manager = new TradeManager(api, settingsRef.current);
        managerRef.current = manager;
        manager.onUpdate(() => refreshStats());
        refreshStats();
        setupSubscriptions(api, selectedGranularity);
      }
    });

    api.on('account', (info: unknown) => setAccount(info as AccountInfo));

    setConnectionStatus('connecting');
    try {
      api.connect(appId);
      await new Promise<void>((resolve, reject) => {
        const check = (s: unknown) => {
          if (s === 'connected') { api.off('status', check as (...args: unknown[]) => void); resolve(); }
          else if (s === 'error') { api.off('status', check as (...args: unknown[]) => void); reject(new Error('Failed')); }
        };
        api.on('status', check as (...args: unknown[]) => void);
        setTimeout(() => reject(new Error('Timeout')), 15000);
      });
      await api.authorize(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
      setConnectionStatus('error');
    }
  }, [selectedGranularity, setupSubscriptions, refreshStats]);

  const disconnect = useCallback(() => {
    setBotStatus('idle');
    botStatusRef.current = 'idle';
    apiRef.current?.disconnect();
    managerRef.current?.destroy();
    apiRef.current = null;
    managerRef.current = null;
    setConnectionStatus('disconnected');
    setAccount(null);
    setError(null);
    setEntryCandles([]);
    setHigherTFCandles([]);
    setCurrentSignal(null);
  }, []);

  useEffect(() => {
    const api = apiRef.current;
    if (!api || connectionStatus !== 'authorized') return;
    return setupSubscriptions(api, selectedGranularity);
  }, [selectedGranularity, connectionStatus, setupSubscriptions]);

  useEffect(() => {
    if (entryCandles.length < 50) return;
    const signal = generateSignal(entryCandles, higherTFCandles.length >= 50 ? higherTFCandles : entryCandles);
    setCurrentSignal(signal);

    const s = settingsRef.current;
    if (botStatusRef.current === 'running' && s.autoTrade && !isTradingRef.current) {
      const check = managerRef.current?.canTrade();
      if (!check?.allowed) {
        setBotStatus('limit_reached');
        setLimitReason(check?.reason ?? 'Limit reached');
        return;
      }
      if (signal.direction !== 'NEUTRAL' && signal.confidence >= s.confidenceThreshold) {
        isTradingRef.current = true;
        managerRef.current?.executeTrade(signal, entryCandles).finally(() => {
          isTradingRef.current = false;
          refreshStats();
        });
      }
    }
  }, [entryCandles, higherTFCandles, refreshStats]);

  useEffect(() => { managerRef.current?.updateSettings(settings); }, [settings]);

  const startBot = useCallback(() => { setLimitReason(null); setBotStatus('running'); }, []);
  const stopBot = useCallback(() => { setBotStatus('stopped'); }, []);

  const manualTrade = useCallback((direction: ContractType) => {
    if (!managerRef.current || !currentSignal || entryCandles.length < 50) return;
    const syntheticSignal = { ...currentSignal, direction, reason: `Manual ${direction} trade` };
    isTradingRef.current = true;
    managerRef.current.executeTrade(syntheticSignal, entryCandles).finally(() => {
      isTradingRef.current = false;
      refreshStats();
    });
  }, [currentSignal, entryCandles, refreshStats]);

  const clearHistory = useCallback(() => {
    managerRef.current?.clearHistory();
    refreshStats();
  }, [refreshStats]);

  useEffect(() => {
    return () => {
      apiRef.current?.disconnect();
      managerRef.current?.destroy();
    };
  }, []);

  return {
    botStatus, currentSignal, entryCandles, higherTFCandles, tradeHistory, dailyStats,
    selectedGranularity, setSelectedGranularity, startBot, stopBot, manualTrade,
    connect, disconnect, connectionStatus, account, error, limitReason, clearHistory,
  };
}

export { calculateAllIndicators };
