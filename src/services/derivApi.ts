import type {
  DerivMessage,
  AccountInfo,
  OHLCCandle,
  Granularity,
  ContractType,
  ProposalResponse,
  BuyResponse,
  ContractUpdateData,
} from '@/src/types';

type EventHandler = (...args: unknown[]) => void;

class EventEmitter {
  private listeners: Map<string, EventHandler[]> = new Map();

  on(event: string, handler: EventHandler): void {
    const existing = this.listeners.get(event) ?? [];
    this.listeners.set(event, [...existing, handler]);
  }

  off(event: string, handler: EventHandler): void {
    const existing = this.listeners.get(event) ?? [];
    this.listeners.set(event, existing.filter(h => h !== handler));
  }

  emit(event: string, ...args: unknown[]): void {
    (this.listeners.get(event) ?? []).forEach(h => h(...args));
  }

  removeAllListeners(event?: string): void {
    if (event) this.listeners.delete(event);
    else this.listeners.clear();
  }
}

interface PendingRequest {
  resolve: (value: DerivMessage) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class DerivApiClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private reqIdCounter = 1;
  private pendingRequests: Map<number, PendingRequest> = new Map();
  private subscriptionReqIds: Map<string, number> = new Map();
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private isManuallyDisconnected = false;
  private currentAppId = '';
  private currentToken = '';
  private missedPings = 0;

  connect(appId: string): void {
    this.currentAppId = appId;
    this.isManuallyDisconnected = false;
    this.reconnectAttempts = 0;
    this._connect();
  }

  private _connect(): void {
    this.emit('status', 'connecting');
    const url = `wss://ws.derivws.com/websockets/v3?app_id=${this.currentAppId}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.missedPings = 0;
      this.emit('status', 'connected');
      this.startPing();
      if (this.currentToken) {
        this.authorize(this.currentToken).catch(() => {});
      }
    };

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        this.handleMessage(JSON.parse(event.data as string) as DerivMessage);
      } catch {
        // ignore malformed messages
      }
    };

    this.ws.onerror = () => {
      this.emit('status', 'error');
    };

    this.ws.onclose = () => {
      this.stopPing();
      if (!this.isManuallyDisconnected) {
        this.scheduleReconnect();
      } else {
        this.emit('status', 'disconnected');
      }
    };
  }

  disconnect(): void {
    this.isManuallyDisconnected = true;
    this.currentToken = '';
    this.stopPing();
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.pendingRequests.forEach(({ reject, timer }) => {
      clearTimeout(timer);
      reject(new Error('Disconnected'));
    });
    this.pendingRequests.clear();
    this.subscriptionReqIds.clear();
    this.ws?.close();
    this.ws = null;
    this.emit('status', 'disconnected');
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= 6) {
      this.emit('status', 'error');
      return;
    }
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 30000);
    this.reconnectAttempts++;
    this.reconnectTimeout = setTimeout(() => {
      this._connect();
    }, delay);
  }

  private startPing(): void {
    this.pingInterval = setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
      if (this.missedPings >= 3) {
        this.ws.close();
        return;
      }
      this.missedPings++;
      this.send({ ping: 1 });
    }, 30000);
  }

  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private send(payload: object): number {
    const reqId = this.reqIdCounter++;
    const message = JSON.stringify({ ...payload, req_id: reqId });
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(message);
    }
    return reqId;
  }

  private sendRequest(payload: object, timeoutMs = 15000): Promise<DerivMessage> {
    return new Promise((resolve, reject) => {
      const reqId = this.reqIdCounter++;
      const timer = setTimeout(() => {
        this.pendingRequests.delete(reqId);
        reject(new Error('Request timeout'));
      }, timeoutMs);

      this.pendingRequests.set(reqId, { resolve, reject, timer });
      const message = JSON.stringify({ ...payload, req_id: reqId });
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(message);
      } else {
        clearTimeout(timer);
        this.pendingRequests.delete(reqId);
        reject(new Error('WebSocket not connected'));
      }
    });
  }

  private handleMessage(msg: DerivMessage): void {
    if (msg.msg_type === 'ping') {
      this.missedPings = 0;
      return;
    }

    if (msg.req_id && this.pendingRequests.has(msg.req_id)) {
      const pending = this.pendingRequests.get(msg.req_id)!;
      clearTimeout(pending.timer);
      this.pendingRequests.delete(msg.req_id);

      if (msg.error) {
        pending.reject(new Error(msg.error.message));
      } else {
        pending.resolve(msg);
      }
      return;
    }

    switch (msg.msg_type) {
      case 'ohlc':
        this.emit('ohlc', msg.ohlc);
        break;
      case 'tick':
        this.emit('tick', msg.tick);
        break;
      case 'proposal_open_contract': {
        const poc = msg.proposal_open_contract as ContractUpdateData | undefined;
        if (poc) this.emit('contract_update', poc);
        break;
      }
      case 'balance': {
        const bal = msg.balance as { balance: number; currency: string; loginid: string } | undefined;
        if (bal) this.emit('balance', bal.balance);
        break;
      }
      default:
        break;
    }
  }

  async authorize(token: string): Promise<AccountInfo> {
    this.currentToken = token;
    const msg = await this.sendRequest({ authorize: token });
    const auth = msg.authorize as {
      loginid: string;
      balance: number;
      currency: string;
      account_type: string;
      fullname?: string;
    };
    const accountInfo: AccountInfo = {
      loginid: auth.loginid,
      balance: auth.balance,
      currency: auth.currency,
      accountType: auth.account_type === 'real' ? 'real' : 'demo',
      fullname: auth.fullname,
    };
    this.emit('status', 'authorized');
    this.emit('account', accountInfo);
    this.getBalance();
    return accountInfo;
  }

  async fetchCandles(symbol: string, granularity: Granularity, count: number): Promise<OHLCCandle[]> {
    const msg = await this.sendRequest({
      ticks_history: symbol,
      adjust_start_time: 1,
      count,
      end: 'latest',
      granularity,
      style: 'candles',
    }, 30000);

    const candles = msg.candles as Array<{ epoch: number; open: string; high: string; low: string; close: string }>;
    return candles.map(c => ({
      epoch: c.epoch,
      open: parseFloat(c.open as unknown as string),
      high: parseFloat(c.high as unknown as string),
      low: parseFloat(c.low as unknown as string),
      close: parseFloat(c.close as unknown as string),
    }));
  }

  subscribeToCandles(symbol: string, granularity: Granularity, count: number): number {
    const subKey = `candles_${granularity}`;
    this.forgetSubscription(subKey);

    const reqId = this.reqIdCounter++;
    this.subscriptionReqIds.set(subKey, reqId);

    const message = JSON.stringify({
      ticks_history: symbol,
      adjust_start_time: 1,
      count,
      end: 'latest',
      granularity,
      style: 'candles',
      subscribe: 1,
      req_id: reqId,
    });

    const timer = setTimeout(() => {
      this.pendingRequests.delete(reqId);
    }, 30000);

    this.pendingRequests.set(reqId, {
      resolve: (msg: DerivMessage) => {
        const candles = msg.candles as Array<{ epoch: number; open: string; high: string; low: string; close: string }>;
        if (candles) {
          const parsed: OHLCCandle[] = candles.map(c => ({
            epoch: c.epoch,
            open: parseFloat(c.open as unknown as string),
            high: parseFloat(c.high as unknown as string),
            low: parseFloat(c.low as unknown as string),
            close: parseFloat(c.close as unknown as string),
          }));
          this.emit(`candles_${granularity}`, parsed);
        }
      },
      reject: () => {},
      timer,
    });

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(message);
    }

    return reqId;
  }

  forgetSubscription(subKey: string): void {
    const reqId = this.subscriptionReqIds.get(subKey);
    if (reqId !== undefined) {
      this.send({ forget: reqId });
      this.subscriptionReqIds.delete(subKey);
      this.pendingRequests.delete(reqId);
    }
  }

  forgetAllSubscriptions(): void {
    this.subscriptionReqIds.forEach((_, key) => this.forgetSubscription(key));
  }

  async getProposal(
    direction: ContractType,
    stake: number,
    durationSeconds: number,
    symbol: string
  ): Promise<ProposalResponse> {
    const msg = await this.sendRequest({
      proposal: 1,
      amount: stake,
      basis: 'stake',
      contract_type: direction,
      currency: 'USD',
      duration: durationSeconds,
      duration_unit: 's',
      symbol,
    });

    const p = msg.proposal as {
      id: string;
      ask_price: number;
      payout: number;
      spot: number;
      display_value: string;
    };
    return {
      id: p.id,
      ask_price: p.ask_price,
      payout: p.payout,
      spot: p.spot,
      display_value: p.display_value,
    };
  }

  async buyContract(proposalId: string, price: number): Promise<BuyResponse> {
    const msg = await this.sendRequest({
      buy: proposalId,
      price,
    });

    const b = msg.buy as {
      contract_id: number;
      buy_price: number;
      payout: number;
      start_time: number;
      longcode: string;
    };
    return {
      contract_id: b.contract_id,
      buy_price: b.buy_price,
      payout: b.payout,
      start_time: b.start_time,
      longcode: b.longcode,
    };
  }

  subscribeToContract(contractId: number): void {
    const subKey = `contract_${contractId}`;
    const reqId = this.reqIdCounter++;
    this.subscriptionReqIds.set(subKey, reqId);

    const message = JSON.stringify({
      proposal_open_contract: 1,
      contract_id: contractId,
      subscribe: 1,
      req_id: reqId,
    });

    const timer = setTimeout(() => {
      this.pendingRequests.delete(reqId);
    }, 5000);

    this.pendingRequests.set(reqId, {
      resolve: () => {},
      reject: () => {},
      timer,
    });

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(message);
    }
  }

  getBalance(): void {
    this.send({ balance: 1, subscribe: 1 });
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

let instance: DerivApiClient | null = null;

export function getDerivApi(): DerivApiClient {
  if (!instance) instance = new DerivApiClient();
  return instance;
}

export function resetDerivApi(): void {
  if (instance) {
    instance.disconnect();
    instance = null;
  }
}
