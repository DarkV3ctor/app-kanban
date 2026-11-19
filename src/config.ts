export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
}

interface KanbanConfig {
  firebase: FirebaseWebConfig | null;
  appAdmins: string[];
  /** reCAPTCHA Enterprise site key for Firebase App Check (optional). */
  appCheckSiteKey: string | null;
}

declare global {
  interface Window {
    KANBAN_CONFIG?: Partial<KanbanConfig>;
  }
}

const raw = window.KANBAN_CONFIG ?? {};

export const config: KanbanConfig = {
  firebase: raw.firebase && raw.firebase.apiKey ? raw.firebase : null,
  appAdmins: (raw.appAdmins ?? []).map(String),
  appCheckSiteKey: typeof raw.appCheckSiteKey === 'string' && raw.appCheckSiteKey ? raw.appCheckSiteKey : null,
};

export const isDemo = !config.firebase;
