import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AppUser } from './types';
import type { Store } from './store';

export interface ToastItem {
  id: number;
  text: string;
  kind: 'info' | 'error' | 'success';
}

export interface ConfirmOptions {
  title: string;
  text?: ReactNode;
  confirmText?: string;
  danger?: boolean;
}

interface AppCtx {
  store: Store;
  user: AppUser;
  toast: (text: string, kind?: ToastItem['kind']) => void;
  confirm: (o: ConfirmOptions) => Promise<boolean>;
  /** Обёртка над async-действием: показывает ошибку тостом. */
  run: <T>(p: Promise<T> | (() => Promise<T>), okText?: string) => Promise<T | undefined>;
}

const Ctx = createContext<AppCtx | null>(null);

export function useApp(): AppCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('AppContext missing');
  return c;
}

export function AppProvider({ store, user, children }: { store: Store; user: AppUser; children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const seq = useRef(0);

  const toast = useCallback((text: string, kind: ToastItem['kind'] = 'info') => {
    const id = ++seq.current;
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 6000 : 3000);
  }, []);

  const confirm = useCallback((o: ConfirmOptions) => new Promise<boolean>((resolve) => setConfirmState({ ...o, resolve })), []);

  const run = useCallback(
    async <T,>(p: Promise<T> | (() => Promise<T>), okText?: string): Promise<T | undefined> => {
      try {
        const r = await (typeof p === 'function' ? p() : p);
        if (okText) toast(okText, 'success');
        return r;
      } catch (e) {
        console.error(e);
        toast(e instanceof Error ? e.message : String(e), 'error');
        return undefined;
      }
    },
    [toast],
  );

  const value = useMemo(() => ({ store, user, toast, confirm, run }), [store, user, toast, confirm, run]);

  const close = (v: boolean) => {
    confirmState?.resolve(v);
    setConfirmState(null);
  };

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`}>
            {t.text}
          </div>
        ))}
      </div>
      {confirmState && (
        <div className="modal-backdrop" onMouseDown={() => close(false)}>
          <div className="modal modal-sm" role="alertdialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>{confirmState.title}</h2>
            </div>
            {confirmState.text && <div className="modal-body">{confirmState.text}</div>}
            <div className="modal-foot">
              <button className="btn btn-subtle" onClick={() => close(false)}>
                Отмена
              </button>
              <button className={confirmState.danger ? 'btn btn-danger' : 'btn btn-primary'} onClick={() => close(true)} autoFocus>
                {confirmState.confirmText ?? 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}
