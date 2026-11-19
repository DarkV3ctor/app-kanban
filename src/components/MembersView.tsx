import { useState } from 'react';
import type { Role } from '../types';
import { useApp } from '../app-context';
import { navigate } from '../router';
import { t, tk } from '../i18n';
import { lookupGitHubUser, type GitHubUser } from '../lib/github';
import { ROLES, roleName } from '../lib/utils';
import { useBoard } from './board-context';
import { GitHubMark, Icon } from './Icons';
import { Avatar, Select } from './ui';

const ASSIGNABLE: Role[] = ['admin', 'editor', 'commenter', 'viewer'];

/** Permission matrix: action → minimal role rank. */
const PERMISSIONS: [string, number][] = [
  [tk('View the board and issues'), 1],
  [tk('Comment'), 2],
  [tk('Create, edit and move issues'), 3],
  [tk('Delete own issues'), 3],
  [tk('Delete any issue or comment'), 4],
  [tk('Columns, types, labels, versions, settings'), 4],
  [tk('Add members and assign roles'), 4],
  [tk('Delete the board and transfer ownership'), 5],
];

export function MembersView() {
  const { user, store, confirm, toast, run } = useApp();
  const { board, perms, issues } = useBoard();
  const [login, setLogin] = useState('');
  const [role, setRole] = useState<Role>('editor');
  const [found, setFound] = useState<GitHubUser | null>(null);
  const [busy, setBusy] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const demo = store.mode === 'local';

  const roleOf = (id: string): Role => (id === board.ownerId ? 'owner' : board.members[id]);
  const members = board.memberIds
    .filter((id) => board.members[id])
    .sort((a, b) => {
      const ra = ROLES.findIndex((r) => r.id === roleOf(a));
      const rb = ROLES.findIndex((r) => r.id === roleOf(b));
      return ra - rb || (board.memberInfo[a]?.login ?? '').localeCompare(board.memberInfo[b]?.login ?? '');
    });

  const lookup = async () => {
    setLookupError(null);
    setFound(null);
    if (!login.trim()) return;
    setBusy(true);
    try {
      setFound(await lookupGitHubUser(login));
    } catch (e) {
      setLookupError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    if (!found) return;
    if (board.members[found.id]) {
      toast(t('@{login} is already a member', { login: found.login }), 'info');
      return;
    }
    try {
      await store.addMember(board.id, found, role);
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'error');
      return;
    }
    toast(t('@{login} added as {role}', { login: found.login, role: roleName(role) }), 'success');
    setFound(null);
    setLogin('');
  };

  const changeRole = (id: string, r: Role) => run(store.setMemberRole(board.id, id, r));

  const remove = async (id: string) => {
    const info = board.memberInfo[id];
    const assigned = issues.filter((i) => i.assigneeId === id).length;
    const ok = await confirm({
      title: t('Remove @{login} from the board?', { login: info?.login ?? id }),
      text: t('They will lose access to the board.') + (assigned ? ' ' + t('Issues assigned to them ({n}) will stay assigned.', { n: assigned }) : ''),
      confirmText: t('Remove'),
      danger: true,
    });
    if (!ok) return;
    await run(store.removeMember(board.id, id));
  };

  const leave = async () => {
    const ok = await confirm({ title: t('Leave the board?'), text: t('You will lose access until someone invites you again.'), confirmText: t('Leave'), danger: true });
    if (!ok) return;
    try {
      await store.removeMember(board.id, user.ghId);
      navigate('/');
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'error');
    }
  };

  const transfer = async (id: string) => {
    const info = board.memberInfo[id];
    const ok = await confirm({
      title: t('Transfer ownership to @{login}?', { login: info?.login ?? id }),
      text: t('The new owner gets full access, including deleting the board. You will become an admin.'),
      confirmText: t('Transfer'),
      danger: true,
    });
    if (!ok) return;
    await run(store.transferOwnership(board.id, user.ghId, id));
  };

  return (
    <div className="members-view">
      <div className="view-head">
        <h1>{t('Members and access')}</h1>
      </div>

      {demo && (
        <div className="alert alert-info">
          <Icon name="info" size={16} />
          <span>{t('In demo mode members are saved, but they cannot sign in — connect Firebase to collaborate (see the README).')}</span>
        </div>
      )}

      {perms.admin && (
        <div className="panel">
          <div className="panel-title">{t('Add a member by GitHub username')}</div>
          <form
            className="inline-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (found) add();
              else lookup();
            }}
          >
            <label className="input-with-icon grow">
              <GitHubMark size={16} />
              <input
                className="input"
                value={login}
                placeholder={t('username, @username or profile link')}
                onChange={(e) => {
                  setLogin(e.target.value);
                  setFound(null);
                  setLookupError(null);
                }}
              />
            </label>
            <Select options={ASSIGNABLE.map((r) => ({ value: r, label: roleName(r) }))} value={role} onChange={(v) => v && setRole(v as Role)} width={200} />
            {found ? (
              <button className="btn btn-primary" type="submit">
                <Icon name="plus" size={16} /> {t('Add')}
              </button>
            ) : (
              <button className="btn btn-primary" type="submit" disabled={busy || !login.trim()}>
                <Icon name="search" size={16} /> {busy ? t('Searching…') : t('Find')}
              </button>
            )}
          </form>
          {lookupError && <div className="alert alert-error">{lookupError}</div>}
          {found && (
            <div className="found-user">
              <Avatar info={found} size={40} />
              <div>
                <div>
                  <b>{found.name}</b> <span className="muted">@{found.login}</span>
                </div>
                <div className="muted small">{t('GitHub ID {id} · will be added as {role}', { id: found.id, role: roleName(role) })}</div>
              </div>
            </div>
          )}
          <p className="muted small">{t('The user will see the board after signing in with GitHub. Access is tied to the numeric GitHub ID, so it survives a username change.')}</p>
        </div>
      )}

      <div className="panel">
        <div className="panel-title">
          {t('Members')} <span className="muted">{members.length}</span>
        </div>
        <div className="member-list">
          {members.map((id) => {
            const info = board.memberInfo[id];
            const isOwner = id === board.ownerId;
            const r = roleOf(id);
            const isMe = id === user.ghId;
            return (
              <div key={id} className="member-row">
                <Avatar info={info} size={36} />
                <div className="member-main">
                  <div>
                    {info?.name ?? id} {isMe && <span className="lozenge lozenge-todo">{t('you')}</span>}
                  </div>
                  <div className="muted small">
                    {info?.login && id !== 'local' ? (
                      <a href={`https://github.com/${info.login}`} target="_blank" rel="noreferrer">
                        @{info.login}
                      </a>
                    ) : (
                      '@' + (info?.login ?? id)
                    )}
                  </div>
                </div>
                {perms.admin && !isOwner && !isMe ? (
                  <Select options={ASSIGNABLE.map((x) => ({ value: x, label: roleName(x) }))} value={r} onChange={(v) => v && changeRole(id, v as Role)} width={200} triggerClass="role-select" />
                ) : (
                  <span className={`role-badge role-${r}`}>{roleName(r)}</span>
                )}
                <div className="member-actions">
                  {perms.owner && !isOwner && (
                    <button className="btn btn-subtle btn-sm" onClick={() => transfer(id)} title={t('Transfer board ownership')}>
                      {t('Make owner')}
                    </button>
                  )}
                  {perms.admin && !isOwner && !isMe && (
                    <button className="icon-btn" onClick={() => remove(id)} title={t('Remove from board')} aria-label={t('Remove from board')}>
                      <Icon name="trash" size={16} />
                    </button>
                  )}
                  {isMe && !isOwner && (
                    <button className="btn btn-subtle btn-sm" onClick={leave}>
                      {t('Leave')}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">{t('Access levels')}</div>
        <div className="table-scroll">
          <table className="perm-table">
            <thead>
              <tr>
                <th>{t('Action')}</th>
                {ROLES.map((r) => (
                  <th key={r.id} title={t(r.description)}>
                    {roleName(r.id)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSIONS.map(([label, min]) => (
                <tr key={label}>
                  <td>{t(label)}</td>
                  {ROLES.map((r) => (
                    <td key={r.id} className="perm-cell">
                      {r.rank >= min ? <Icon name="check" size={16} className="perm-yes" /> : <span className="perm-no">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
