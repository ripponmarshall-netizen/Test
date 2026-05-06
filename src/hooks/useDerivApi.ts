import { useState, useEffect, useRef, useCallback } from 'react';
import type { ConnectionStatus, AccountInfo } from '@/src/types';
import { DerivApiClient } from '@/src/services/derivApi';

export function useDerivApi() {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const apiRef = useRef<DerivApiClient | null>(null);

  const connect = useCallback(async (appId: string, token: string): Promise<void> => {
    if (apiRef.current) {
      apiRef.current.disconnect();
    }
    apiRef.current = new DerivApiClient();
    const api = apiRef.current;

    const handleStatus = (s: unknown) => {
      setStatus(s as ConnectionStatus);
      if (s === 'error') setError('Connection error. Retrying...');
      else setError(null);
    };

    const handleAccount = (info: unknown) => {
      setAccount(info as AccountInfo);
    };

    api.on('status', handleStatus as (...args: unknown[]) => void);
    api.on('account', handleAccount as (...args: unknown[]) => void);

    try {
      api.connect(appId);
      await new Promise<void>((resolve, reject) => {
        const onStatus = (s: unknown) => {
          if (s === 'connected') {
            resolve();
          } else if (s === 'error') {
            reject(new Error('Connection failed'));
          }
        };
        api.on('status', onStatus as (...args: unknown[]) => void);
        setTimeout(() => reject(new Error('Connection timeout')), 15000);
      });

      await api.authorize(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
      setStatus('error');
    }
  }, []);

  const disconnect = useCallback(() => {
    apiRef.current?.disconnect();
    apiRef.current = null;
    setStatus('disconnected');
    setAccount(null);
    setError(null);
  }, []);

  useEffect(() => {
    return () => {
      apiRef.current?.disconnect();
    };
  }, []);

  return { status, account, error, connect, disconnect, api: apiRef.current };
}
