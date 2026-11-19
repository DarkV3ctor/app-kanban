import type { MemberInfo } from '../types';

export interface GitHubUser extends MemberInfo {
  id: string;
}

const cache = new Map<string, GitHubUser>();

/** Ищет пользователя GitHub по логину через публичный API (без токена, 60 запросов/час). */
export async function lookupGitHubUser(login: string): Promise<GitHubUser> {
  const clean = login.trim().replace(/^@/, '').replace(/^https?:\/\/github\.com\//i, '').replace(/\/.*$/, '');
  if (!/^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i.test(clean)) {
    throw new Error('Некорректный логин GitHub');
  }
  const k = clean.toLowerCase();
  const hit = cache.get(k);
  if (hit) return hit;
  const res = await fetch(`https://api.github.com/users/${encodeURIComponent(clean)}`, {
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (res.status === 404) throw new Error(`Пользователь «${clean}» не найден на GitHub`);
  if (res.status === 403 || res.status === 429) throw new Error('Превышен лимит запросов к GitHub API, попробуйте позже');
  if (!res.ok) throw new Error(`Ошибка GitHub API: ${res.status}`);
  const j = await res.json();
  if (j.type && j.type !== 'User') throw new Error('Можно добавить только пользователя, а не организацию');
  const u: GitHubUser = { id: String(j.id), login: j.login, name: j.name || j.login, avatarUrl: j.avatar_url };
  cache.set(k, u);
  return u;
}

/** Профиль по числовому ID (используется при восстановлении сессии). */
export async function lookupGitHubUserById(id: string): Promise<GitHubUser | null> {
  try {
    const res = await fetch(`https://api.github.com/user/${encodeURIComponent(id)}`, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) return null;
    const j = await res.json();
    return { id: String(j.id), login: j.login, name: j.name || j.login, avatarUrl: j.avatar_url };
  } catch {
    return null;
  }
}
