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
};

export const isDemo = !config.firebase;
