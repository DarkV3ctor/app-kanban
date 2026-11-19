/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

interface AppConfig {
  firebase?: { authDomain?: string } | null;
  appCheckSiteKey?: string | null;
}

/** Reads public/config.js (the same file the browser loads) to tailor the CSP to it. */
function readAppConfig(): AppConfig {
  const sandbox: { window: { KANBAN_CONFIG?: AppConfig } } = { window: {} };
  runInNewContext(readFileSync(new URL('./public/config.js', import.meta.url), 'utf8'), sandbox);
  return sandbox.window.KANBAN_CONFIG ?? {};
}

/**
 * Content Security Policy for the production build. GitHub Pages cannot send headers, so it is a
 * <meta> tag. Dev mode is left alone: Vite's hot reload needs inline scripts.
 */
function contentSecurityPolicy(): Plugin {
  return {
    name: 'kanban-csp',
    apply: 'build',
    transformIndexHtml() {
      const cfg = readAppConfig();
      const authDomain = cfg.firebase?.authDomain;
      const recaptcha = cfg.appCheckSiteKey ? ['https://www.google.com/recaptcha/', 'https://www.gstatic.com/recaptcha/'] : [];
      const policy: Record<string, string[]> = {
        'default-src': ["'self'"],
        // apis.google.com: Firebase Auth's popup helper.
        'script-src': ["'self'", 'https://apis.google.com', ...recaptcha],
        // React sets inline style attributes.
        'style-src': ["'self'", "'unsafe-inline'"],
        // https: avatars and images in Markdown (loaded only after a click).
        'img-src': ["'self'", 'data:', 'https:'],
        'font-src': ["'self'", 'data:'],
        'connect-src': ["'self'", 'https://*.googleapis.com', 'https://api.github.com', ...recaptcha],
        'frame-src': [...(authDomain ? [`https://${authDomain}`] : []), ...(cfg.appCheckSiteKey ? ['https://www.google.com/recaptcha/', 'https://recaptcha.google.com/recaptcha/'] : [])],
        'object-src': [],
        'base-uri': ["'self'"],
        'form-action': [],
      };
      const content = Object.entries(policy)
        .map(([k, v]) => `${k} ${v.length ? v.join(' ') : "'none'"}`)
        .join('; ');
      return [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content }, injectTo: 'head-prepend' }];
    },
  };
}

/**
 * With Firebase configured, nothing can render before the Firebase chunk has loaded. It is a
 * dynamic import (demo mode does not need it), so without a hint the browser would request it only
 * after the main chunk has run; <link rel="modulepreload"> lets both download in parallel.
 */
function preloadFirebaseChunk(): Plugin {
  return {
    name: 'kanban-preload-firebase',
    apply: 'build',
    transformIndexHtml(_html, ctx) {
      if (!readAppConfig().firebase) return;
      const chunk = Object.values(ctx.bundle ?? {}).find(
        (c) => c.type === 'chunk' && !!c.facadeModuleId && c.facadeModuleId.replace(/\\/g, '/').endsWith('/src/store/firebaseStore.ts'),
      );
      if (!chunk) return;
      return [{ tag: 'link', attrs: { rel: 'modulepreload', crossorigin: true, href: `./${chunk.fileName}` }, injectTo: 'head' }];
    },
  };
}

// base: './' — relative asset paths so the site works at https://<user>.github.io/<repo>/
export default defineConfig({
  base: './',
  plugins: [react(), contentSecurityPolicy(), preloadFirebaseChunk()],
  build: { chunkSizeWarningLimit: 1500 },
});
