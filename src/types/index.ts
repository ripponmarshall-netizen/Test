export interface OHLCCandle {
  epoch: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface Tick {
  epoch: number;
  price: number;
  symbol: string;
}

export type Granularity = 60 | 300 | 3600 | 14400 | 86400;

export interface Timeframe {
  label: string;
  granularity: Granularity;
  candleCount: number;
}

export const TIMEFRAMES: Timeframe[] = [
  { label: '1M', granularity: 60, candleCount: 250 },
  { label: '5M', granularity: 300, candleCount: 250 },
  { label: '1H', granularity: 3600, candleCount: 250 },
  { label: '4H', granularity: 14400, candleCount: 250 },
  { label: '1D', granularity: 86400, candleCount: 250 },
];

export interface EMAResult {
  ema20: number[];
  ema50: number[];
  ema200: number[];
}

export interface RSIResult {
  values: number[];
}

export interface MACDResult {
  macd: number[];
  signal: number[];
  histogram: number[];
}

export interface BollingerResult {
  upper: number[];
  middle: number[];
  lower: number[];
  percentB: number[];
}

export interface IndicatorSet {
  ema: EMAResult;
  rsi: RSIResult;
  macd: MACDResult;
  bollinger: BollingerResult;
  calculatedAt: number;
}

export type SignalDirection = 'CALL' | 'PUT' | 'NEUTRAL';

export interface SignalComponent {
  name: string;
  direction: SignalDirection;
  value: string;
  score: number;
  weight: number;
}

export interface Signal {
  direction: SignalDirection;
  confidence: number;
  components: SignalComponent[];
  timestamp: number;
  higherTFTrend: SignalDirection;
  entryTFSignal: SignalDirection;
  reason: string;
}

export type ContractType = 'CALL' | 'PUT';
export type TradeStatus = 'pending' | 'open' | 'won' | 'lost' | 'cancelled';

export interface TradeLog {
  id: string;
  timestamp: number;
  direction: ContractType;
  stake: number;
  entryPrice: number;
  exitPrice?: number;
  pnl?: number;
  status: TradeStatus;
  contractId?: string;
  confidence: number;
  indicators: {
    ema20: number;
    ema50: number;
    ema200: number;
    rsi: number;
    macd: number;
    macdSignal: number;
    bbUpper: number;
    bbMiddle: number;
    bbLower: number;
  };
  reason: string;
  duration: number;
  symbol: string;
}

export interface TradeSettings {
  appId: string;
  token: string;
  stake: number;
  contractDuration: number;
  confidenceThreshold: number;
  maxDailyLoss: number;
  maxDailyProfit: number;
  maxDailyTrades: number;
  maxConcurrentTrades: number;
  autoTrade: boolean;
  symbol: string;
  entryGranularity: Granularity;
}

export const DEFAULT_SETTINGS: TradeSettings = {
  appId: '1089',
  token: '',
  symbol: 'R_25',
  stake: 5,
  contractDuration: 300,
  confidenceThreshold: 70,
  maxDailyLoss: 50,
  maxDailyProfit: 100,
  maxDailyTrades: 20,
  maxConcurrentTrades: 2,
  autoTrade: false,
  entryGranularity: 60,
};

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'authorized' | 'error';

export interface AccountInfo {
  loginid: string;
  balance: number;
  currency: string;
  accountType: 'demo' | 'real';
  fullname?: string;
}

export type BotStatus = 'idle' | 'running' | 'stopped' | 'error' | 'limit_reached';

export interface DailyStats {
  tradesCount: number;
  totalPnl: number;
  wins: number;
  losses: number;
  openTrades: number;
}

export interface DerivMessage {
  msg_type: string;
  req_id?: number;
  error?: { code: string; message: string };
  [key: string]: unknown;
}

export interface ProposalResponse {
  id: string;
  ask_price: number;
  payout: number;
  spot: number;
  display_value: string;
}

export interface BuyResponse {
  contract_id: number;
  buy_price: number;
  payout: number;
  start_time: number;
  longcode: string;
}

export interface ContractUpdateData {
  contract_id: number;
  is_expired: boolean;
  is_sold: boolean;
  profit: number;
  buy_price: number;
  sell_price?: number;
  current_spot?: number;
  exit_tick?: number;
  status?: string;
}
