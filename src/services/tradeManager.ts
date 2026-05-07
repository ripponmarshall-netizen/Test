import type {
  TradeLog,
  TradeSettings,
  DailyStats,
  ContractType,
  Signal,
  ContractUpdateData,
} from '@/src/types';
import type { DerivApiClient } from './derivApi';
import { calculateAllIndicators, getLastValid } from './indicators';
import type { OHLCCandle } from '@/src/types';

const STORAGE_KEY = 'deriv_bot_trades';
const MAX_STORED_TRADES = 500;

function todayKey(): string {
  return new Date().toDateString();
}

export function loadSettings(key = 'deriv_bot_settings'): TradeSettings | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as TradeSettings) : null;
  } catch {
    return null;
  }
}

export function saveSettings(settings: TradeSettings, key = 'deriv_bot_settings'): void {
  localStorage.setItem(key, JSON.stringify(settings));
}

export class TradeManager {
  private trades: TradeLog[] = [];
  private settings: TradeSettings;
  private api: DerivApiClient;
  private onUpdateCallbacks: Array<(trades: TradeLog[]) => void> = [];

  constructor(api: DerivApiClient, settings: TradeSettings) {
    this.api = api;
    this.settings = settings;
    this.loadTrades();
    this.api.on('contract_update', this.handleContractUpdate as (...args: unknown[]) => void);
  }

  updateSettings(settings: TradeSettings): void {
    this.settings = settings;
  }

  onUpdate(cb: (trades: TradeLog[]) => void): void {
    this.onUpdateCallbacks.push(cb);
  }

  private notifyUpdate(): void {
    this.onUpdateCallbacks.forEach(cb => cb([...this.trades]));
  }

  private handleContractUpdate = (data: ContractUpdateData): void => {
    const trade = this.trades.find(t => t.contractId === String(data.contract_id));
    if (!trade) return;

    if (data.is_expired || data.is_sold) {
      trade.exitPrice = data.exit_tick ?? data.current_spot ?? trade.entryPrice;
      trade.pnl = data.profit;
      trade.status = data.profit >= 0 ? 'won' : 'lost';
      this.saveTrades();
      this.notifyUpdate();
    }
  };

  canTrade(): { allowed: boolean; reason?: string } {
    const todayTrades = this.getTodayTrades();
    if (todayTrades.length >= this.settings.maxDailyTrades) {
      return { allowed: false, reason: `Max daily trades reached (${this.settings.maxDailyTrades})` };
    }

    const closedTrades = todayTrades.filter(t => t.pnl !== undefined);
    const todayPnl = closedTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);

    if (todayPnl <= -this.settings.maxDailyLoss) {
      return { allowed: false, reason: `Daily loss limit hit (-$${this.settings.maxDailyLoss})` };
    }
    if (todayPnl >= this.settings.maxDailyProfit) {
      return { allowed: false, reason: `Daily profit target reached (+$${this.settings.maxDailyProfit})` };
    }

    const openTrades = todayTrades.filter(t => t.status === 'open' || t.status === 'pending');
    if (openTrades.length >= this.settings.maxConcurrentTrades) {
      return { allowed: false, reason: `Max concurrent open trades reached (${this.settings.maxConcurrentTrades})` };
    }

    return { allowed: true };
  }

  async executeTrade(signal: Signal, currentCandles: OHLCCandle[]): Promise<TradeLog | null> {
    const check = this.canTrade();
    if (!check.allowed) return null;

    const indicators = calculateAllIndicators(currentCandles);
    const lastClose = currentCandles[currentCandles.length - 1].close;

    const tradeLog: TradeLog = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      direction: signal.direction as ContractType,
      stake: this.settings.stake,
      entryPrice: lastClose,
      status: 'pending',
      confidence: signal.confidence,
      indicators: {
        ema20: getLastValid(indicators.ema.ema20),
        ema50: getLastValid(indicators.ema.ema50),
        ema200: getLastValid(indicators.ema.ema200),
        rsi: getLastValid(indicators.rsi.values),
        macd: getLastValid(indicators.macd.macd),
        macdSignal: getLastValid(indicators.macd.signal),
        bbUpper: getLastValid(indicators.bollinger.upper),
        bbMiddle: getLastValid(indicators.bollinger.middle),
        bbLower: getLastValid(indicators.bollinger.lower),
      },
      reason: signal.reason,
      duration: this.settings.contractDuration,
      symbol: this.settings.symbol,
    };

    this.trades.push(tradeLog);
    this.notifyUpdate();

    try {
      let proposal = await this.api.getProposal(
        signal.direction as ContractType,
        this.settings.stake,
        this.settings.contractDuration,
        this.settings.symbol
      );

      let buy;
      try {
        buy = await this.api.buyContract(proposal.id, proposal.ask_price);
      } catch (err) {
        if (err instanceof Error && err.message.includes('expired')) {
          proposal = await this.api.getProposal(
            signal.direction as ContractType,
            this.settings.stake,
            this.settings.contractDuration,
            this.settings.symbol
          );
          buy = await this.api.buyContract(proposal.id, proposal.ask_price);
        } else {
          throw err;
        }
      }

      tradeLog.contractId = String(buy.contract_id);
      tradeLog.entryPrice = buy.buy_price;
      tradeLog.status = 'open';

      this.api.subscribeToContract(buy.contract_id);
    } catch (err) {
      tradeLog.status = 'cancelled';
      tradeLog.reason += ` [Failed: ${err instanceof Error ? err.message : 'Unknown error'}]`;
    }

    this.saveTrades();
    this.notifyUpdate();
    return tradeLog;
  }

  getDailyStats(): DailyStats {
    const todayTrades = this.getTodayTrades();
    const closedTrades = todayTrades.filter(t => t.pnl !== undefined);
    const wins = closedTrades.filter(t => (t.pnl ?? 0) >= 0).length;
    const losses = closedTrades.filter(t => (t.pnl ?? 0) < 0).length;
    const openTrades = todayTrades.filter(t => t.status === 'open' || t.status === 'pending').length;

    return {
      tradesCount: todayTrades.length,
      totalPnl: closedTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0),
      wins,
      losses,
      openTrades,
    };
  }

  getTodayTrades(): TradeLog[] {
    const key = todayKey();
    return this.trades.filter(t => new Date(t.timestamp).toDateString() === key);
  }

  getAllTrades(): TradeLog[] {
    return [...this.trades].reverse();
  }

  loadTrades(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) this.trades = JSON.parse(raw) as TradeLog[];
    } catch {
      this.trades = [];
    }
  }

  saveTrades(): void {
    if (this.trades.length > MAX_STORED_TRADES) {
      this.trades = this.trades.slice(this.trades.length - MAX_STORED_TRADES);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.trades));
  }

  clearHistory(): void {
    this.trades = [];
    localStorage.removeItem(STORAGE_KEY);
    this.notifyUpdate();
  }

  destroy(): void {
    this.api.off('contract_update', this.handleContractUpdate as (...args: unknown[]) => void);
    this.onUpdateCallbacks = [];
  }
}
