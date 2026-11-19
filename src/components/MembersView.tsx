import { useState } from 'react';
import type { Role } from '../types';
import { useApp } from '../app-context';
import { navigate } from '../router';
import { lookupGitHubUser, type GitHubUser } from '../lib/github';
import { ROLES, roleName } from '../lib/utils';
import { useBoard } from './board-context';
import { GitHubMark, Icon } from './Icons';
import { Avatar, Select } from './ui';

const ASSIGNABLE: Role[] = ['admin', 'editor', 'commenter', 'viewer'];

export function MembersView() {
  const { user, store, confirm, toast } = useApp();
  const { board, perms, issues, updateBoard } = useBoard();
  const [login, setLogin] = useState('');
  const [role, setRole] = useState<Role>('editor');
  const [found, setFound] = useState<GitHubUser | null>(null);
  const [busy, setBusy] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const demo = store.mode === 'local';

  const members = board.memberIds
    .filter((id) => board.members[id])
    .sort((a, b) => {
      const ra = ROLES.findIndex((r) => r.id === (a === board.ownerId ? 'owner' : board.members[a]));
      const rb = ROLES.findIndex((r) => r.id === (b === board.ownerId ? 'owner' : board.members[b]));
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
      toast(`@${found.login} уже участник`, 'info');
      return;
    }
    await updateBoard({
      members: { ...board.members, [found.id]: role },
      memberIds: [...board.memberIds.filter((x) => x !== found.id), found.id],
      memberInfo: { ...board.memberInfo, [found.id]: { login: found.login, name: found.name, avatarUrl: found.avatarUrl } },
    });
    toast(`@${found.login} добавлен(а) как «${roleName(role)}»`, 'success');
    setFound(null);
    setLogin('');
  };

  const changeRole = (id: string, r: Role) => updateBoard({ members: { ...board.members, [id]: r } });

  const remove = async (id: string) => {
    const info = board.memberInfo[id];
    const assigned = issues.filter((i) => i.assigneeId === id).length;
    const ok = await confirm({
      title: `Удалить @${info?.login ?? id} из доски?`,
      text: `Пользователь потеряет доступ к доске.${assigned ? ` На него назначено задач: ${assigned} — они останутся назначенными.` : ''}`,
      confirmText: 'Удалить',
      danger: true,
    });
    if (!ok) return;
    const members = { ...board.members };
    delete members[id];
    await updateBoard({ members, memberIds: board.memberIds.filter((x) => x !== id) });
  };

  const leave = async () => {
    const ok = await confirm({ title: 'Покинуть доску?', text: 'Вы потеряете доступ, пока вас снова не пригласят.', confirmText: 'Покинуть', danger: true });
    if (!ok) return;
    const members = { ...board.members };
    delete members[user.ghId];
    try {
      await store.updateBoard(board.id, { members, memberIds: board.memberIds.filter((x) => x !== user.ghId) });
      navigate('/');
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'error');
    }
  };

  const transfer = async (id: string) => {
    const info = board.memberInfo[id];
    const ok = await confirm({
      title: `Передать владение @${info?.login}?`,
      text: 'Новый владелец получит полный доступ, включая удаление доски. Вы станете администратором.',
      confirmText: 'Передать',
      danger: true,
    });
    if (!ok) return;
    await updateBoard({ ownerId: id, members: { ...board.members, [id]: 'owner', [user.ghId]: 'admin' } });
  };

  return (
    <div className="members-view">
      <div className="view-head">
        <h1>Участники и доступ</h1>
      </div>

      {demo && (
        <div className="alert alert-info">
          <Icon name="info" size={16} /> В демо-режиме участники сохраняются, но войти они не смогут — для совместной работы подключите Firebase (см. README).
        </div>
      )}

      {perms.admin && (
        <div className="panel">
          <div className="panel-title">Добавить участника по GitHub-логину</div>
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
                placeholder="логин, @логин или ссылка на профиль"
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
                <Icon name="plus" size={16} /> Добавить
              </button>
            ) : (
              <button className="btn btn-primary" type="submit" disabled={busy || !login.trim()}>
                <Icon name="search" size={16} /> {busy ? 'Поиск…' : 'Найти'}
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
                <div className="muted small">GitHub ID {found.id} · будет добавлен(а) как «{roleName(role)}»</div>
              </div>
            </div>
          )}
          <p className="muted small">
            Пользователь увидит доску после входа через GitHub. Права привязаны к числовому GitHub ID, поэтому сохраняются даже при смене логина.
          </p>
        </div>
      )}

      <div className="panel">
        <div className="panel-title">
          Участники <span className="muted">{members.length}</span>
        </div>
        <div className="member-list">
          {members.map((id) => {
            const info = board.memberInfo[id];
            const isOwner = id === board.ownerId;
            const r: Role = isOwner ? 'owner' : board.members[id];
            const isMe = id === user.ghId;
            return (
              <div key={id} className="member-row">
                <Avatar info={info} size={36} />
                <div className="member-main">
                  <div>
                    {info?.name ?? id} {isMe && <span className="lozenge lozenge-todo">вы</span>}
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
                    <button className="btn btn-subtle btn-sm" onClick={() => transfer(id)} title="Передать владение доской">
                      Сделать владельцем
                    </button>
                  )}
                  {perms.admin && !isOwner && !isMe && (
                    <button className="icon-btn" onClick={() => remove(id)} title="Удалить из доски" aria-label="Удалить из доски">
                      <Icon name="trash" size={16} />
                    </button>
                  )}
                  {isMe && !isOwner && (
                    <button className="btn btn-subtle btn-sm" onClick={leave}>
                      Покинуть
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">Уровни доступа</div>
        <table className="perm-table">
          <thead>
            <tr>
              <th>Действие</th>
              {ROLES.map((r) => (
                <th key={r.id}>{r.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              ['Просмотр доски и задач', 1],
              ['Комментарии', 2],
              ['Создание, редактирование и перемещение задач', 3],
              ['Удаление своих задач', 3],
              ['Удаление любых задач и комментариев', 4],
              ['Колонки, типы, метки, версии, настройки', 4],
              ['Добавление участников и назначение прав', 4],
              ['Удаление доски и передача владения', 5],
            ].map(([label, min]) => (
              <tr key={label as string}>
                <td>{label}</td>
                {ROLES.map((r) => (
                  <td key={r.id} className="perm-cell">
                    {r.rank >= (min as number) ? <Icon name="check" size={16} className="perm-yes" /> : <span className="perm-no">—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
