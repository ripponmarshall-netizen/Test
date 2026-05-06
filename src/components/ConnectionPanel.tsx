import { useState, useEffect } from 'react';
import type { ConnectionStatus, AccountInfo, TradeSettings } from '@/src/types';

interface Props {
  status: ConnectionStatus;
  account: AccountInfo | null;
  error: string | null;
  settings: TradeSettings;
  onConnect: (appId: string, token: string) => void;
  onDisconnect: () => void;
  onSettingsChange: (s: Partial<TradeSettings>) => void;
}

const STATUS_LABELS: Record<ConnectionStatus, string> = {
  disconnected: 'Disconnected',
  connecting: 'Connecting...',
  connected: 'Authenticating...',
  authorized: 'Connected',
  error: 'Error',
};

export function ConnectionPanel({ status, account, error, settings, onConnect, onDisconnect, onSettingsChange }: Props) {
  const [appId, setAppId] = useState(settings.appId);
  const [token, setToken] = useState(settings.token);
  const [showToken, setShowToken] = useState(false);

  useEffect(() => { setAppId(settings.appId); setToken(settings.token); }, [settings.appId, settings.token]);

  const isConnected = status === 'authorized';
  const isConnecting = status === 'connecting' || status === 'connected';

  const handleConnect = () => { onSettingsChange({ appId, token }); onConnect(appId, token); };

  const dotClass = status === 'authorized' ? 'connected'
    : status === 'connecting' || status === 'connected' ? 'connecting'
    : status === 'error' ? 'error' : 'disconnected';

  return (
    <div className="panel p-3 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Connection</span>
        <div className="flex items-center gap-1.5">
          <span className={`status-dot ${dotClass}`} />
          <span className="text-xs text-[var(--color-text-secondary)]">{STATUS_LABELS[status]}</span>
        </div>
      </div>

      {!isConnected && (
        <>
          <div>
            <label className="label">App ID</label>
            <input className="input-field" value={appId} onChange={e => setAppId(e.target.value)} placeholder="1089" disabled={isConnecting} />
            <p className="text-xs text-[var(--color-text-secondary)] mt-1">
              <a href="https://developers.deriv.com" target="_blank" rel="noreferrer" className="underline hover:text-[var(--color-accent)]">Get your App ID</a>
            </p>
          </div>
          <div>
            <label className="label">API Token</label>
            <div className="flex gap-1">
              <input className="input-field" type={showToken ? 'text' : 'password'} value={token} onChange={e => setToken(e.target.value)} placeholder="Enter Deriv API token" disabled={isConnecting} />
              <button className="btn-primary px-2 text-xs shrink-0" onClick={() => setShowToken(v => !v)} type="button">{showToken ? 'Hide' : 'Show'}</button>
            </div>
          </div>
          <button className="btn-primary w-full" onClick={handleConnect} disabled={isConnecting || !appId || !token}>
            {isConnecting ? 'Connecting...' : 'Connect'}
          </button>
        </>
      )}

      {isConnected && account && (
        <>
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <span className="text-xs text-[var(--color-text-secondary)]">Account</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${account.accountType === 'demo' ? 'bg-blue-500/20 text-blue-400' : 'bg-orange-500/20 text-orange-400'}`}>
                {account.accountType.toUpperCase()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-[var(--color-text-secondary)]">ID</span>
              <span className="text-xs font-mono text-[var(--color-text-primary)]">{account.loginid}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-[var(--color-text-secondary)]">Balance</span>
              <span className="text-sm font-bold text-[var(--color-profit)]">{account.currency} {account.balance.toFixed(2)}</span>
            </div>
          </div>
          {account.accountType === 'real' && (
            <div className="bg-orange-500/10 border border-orange-500/30 rounded p-2 text-xs text-orange-400">⚠ Live account — real money at risk</div>
          )}
          <button className="btn-danger w-full" onClick={onDisconnect}>Disconnect</button>
        </>
      )}

      {error && <p className="text-xs text-[var(--color-loss)] bg-red-500/10 rounded p-2">{error}</p>}
    </div>
  );
}
