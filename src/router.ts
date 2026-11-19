import { useEffect, useState } from 'react';

export interface Route {
  path: string;
  segments: string[];
  query: URLSearchParams;
}

function parse(): Route {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, qs = ''] = raw.split('?');
  return { path, segments: path.split('/').filter(Boolean), query: new URLSearchParams(qs) };
}

export function useRoute(): Route {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const h = () => setRoute(parse());
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);
  return route;
}

export function navigate(path: string, replace = false) {
  const url = '#' + path;
  if (replace) {
    history.replaceState(null, '', url);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    location.hash = path;
  }
}

/** Sets a query parameter in the current hash without touching the path. */
export function setQueryParam(key: string, value: string | null, replace = false) {
  const r = parse();
  if (value === null) r.query.delete(key);
  else r.query.set(key, value);
  const qs = r.query.toString();
  navigate(r.path + (qs ? '?' + qs : ''), replace);
}
