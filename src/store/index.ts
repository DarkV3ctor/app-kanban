import { config } from '../config';
import { localStore } from './localStore';
import type { Store } from './types';

export type { Store, Unsub, CreatorEntry, NewBoardInput } from './types';

let store: Store = localStore;

/** Loads Firebase only when it is configured, so demo mode stays lightweight. */
export async function initStore(): Promise<Store> {
  if (config.firebase) {
    const { createFirebaseStore } = await import('./firebaseStore');
    store = createFirebaseStore(config.firebase);
  }
  return store;
}

export function getStore(): Store {
  return store;
}
