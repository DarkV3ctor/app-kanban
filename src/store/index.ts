import { config } from '../config';
import { localStore } from './localStore';
import type { Store } from './types';

export type { Store, Unsub, CreatorEntry, NewBoardInput } from './types';

let store: Store = localStore;

/** Загружает Firebase только если он настроен — в демо-режиме бандл остаётся лёгким. */
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
