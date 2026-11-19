import type { MemberInfo } from '../types';
import { t } from '../i18n';

export interface GitHubUser extends MemberInfo {
  id: string;
}

const cache = new Map<string, GitHubUser>();

/** Look up a GitHub user by login via the public API (no token, 60 requests/hour). */
export async function lookupGitHubUser(login: string): Promise<GitHubUser> {
  const clean = login
    .trim()
    .replace(/^@/, '')
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/\/.*$/, '');
  if (!/^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i.test(clean)) {
    throw new Error(t('Invalid GitHub username'));
  }
  const k = clean.toLowerCase();
  const hit = cache.get(k);
  if (hit) return hit;
  const res = await fetch(`https://api.github.com/users/${encodeURIComponent(clean)}`, {
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (res.status === 404) throw new Error(t('GitHub user "{login}" not found', { login: clean }));
  if (res.status === 403 || res.status === 429) throw new Error(t('GitHub API rate limit exceeded, try again later'));
  if (!res.ok) throw new Error(t('GitHub API error: {status}', { status: res.status }));
  const j = await res.json();
  if (j.type && j.type !== 'User') throw new Error(t('Only users can be added, not organizations'));
  const u: GitHubUser = { id: String(j.id), login: j.login, name: j.name || j.login, avatarUrl: j.avatar_url };
  cache.set(k, u);
  return u;
}

/** Profile by numeric ID (used when restoring a session). */
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
