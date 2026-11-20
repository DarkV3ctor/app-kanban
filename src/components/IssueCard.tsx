import { memo } from 'react';
import type { Board, Issue } from '../types';
import { dueState, formatDate, hashColor, isDone, cls, todayISO } from '../lib/utils';
import { fieldName, hasField, nobodyLabel, pointsAreRating, priorityLabel } from '../lib/fields';
import { Icon, PriorityIcon, TypeIcon } from './Icons';
import { t } from '../i18n';
import { Avatar, LabelChip, memberOf } from './ui';
import { CoverImage } from './Cover';

/** A release date on a card: the full date while it is ahead, just the year once it is out. */
function ReleaseBadge({ board, date }: { board: Board; date: string }) {
  const upcoming = date > todayISO();
  return (
    <span className={cls('card-badge', upcoming && 'release-upcoming')} title={`${fieldName(board, 'releaseDate')}: ${formatDate(date)}`}>
      {upcoming && <Icon name="clock" size={12} />}
      {upcoming ? formatDate(date) : date.slice(0, 4)}
    </span>
  );
}

interface Props {
  board: Board;
  issue: Issue;
  epic?: Issue;
  onOpen: (i: Issue) => void;
  dragging?: boolean;
}

export const IssueCard = memo(function IssueCard({ board, issue, epic, onOpen, dragging }: Props) {
  const type = board.issueTypes.find((t) => t.id === issue.type);
  const done = isDone(board, issue);
  const due = dueState(issue.dueDate, done);
  const version = issue.fixVersionId ? board.versions.find((v) => v.id === issue.fixVersionId) : undefined;
  const checkDone = issue.checklist.filter((c) => c.done).length;
  const key = `${board.key}-${issue.number}`;
  const assignee = memberOf(board, issue.assigneeId);
  const blocked = issue.links?.some((l) => l.type === 'blocked_by');

  return (
    <div
      className={cls('card', dragging && 'is-dragging', type?.isEpic && 'card-epic')}
      onClick={() => onOpen(issue)}
      onKeyDown={(e) => e.key === 'Enter' && onOpen(issue)}
      role="button"
      tabIndex={0}
      aria-label={`${key} ${issue.title}`}
    >
      {issue.cover && hasField(board, 'cover') && <CoverImage src={issue.cover} className="card-cover" />}
      <div className="card-title">{issue.title}</div>
      {(epic || issue.labels.length > 0 || version) && (
        <div className="card-tags">
          {epic && (
            <span className="epic-tag" style={{ ['--epic' as string]: hashColor(epic.id) }} title={t('Epic: {name}', { name: epic.title })}>
              {epic.title}
            </span>
          )}
          {issue.labels.slice(0, 3).map((l) => (
            <LabelChip key={l} text={l} />
          ))}
          {issue.labels.length > 3 && <span className="chip chip-more">+{issue.labels.length - 3}</span>}
          {version && (
            <span className="version-tag" title={t('Version: {name}', { name: version.name })}>
              <Icon name="release" size={11} />
              {version.name}
            </span>
          )}
        </div>
      )}
      <div className="card-meta">
        <TypeIcon type={type} />
        <span className={cls('card-key', done && 'is-done')}>{key}</span>
        {blocked && (
          <span className="card-blocked" title={t('Blocked by another issue')}>
            ⛔
          </span>
        )}
        {/* Badges, priority and assignee: when they do not fit next to the key, they move to a line of their own, on the right. */}
        <span className="card-meta-end">
          {issue.checklist.length > 0 && (
            <span className={cls('card-badge', checkDone === issue.checklist.length && 'is-complete')} title={t('Checklist')}>
              <Icon name="checklist" size={13} />
              {checkDone}/{issue.checklist.length}
            </span>
          )}
          {issue.dueDate && (
            <span className={cls('card-badge', due && `due-${due}`)} title={t('Due: {date}', { date: formatDate(issue.dueDate) })}>
              <Icon name="calendar" size={12} />
              {formatDate(issue.dueDate)}
            </span>
          )}
          {issue.releaseDate && hasField(board, 'releaseDate') && <ReleaseBadge board={board} date={issue.releaseDate} />}
          {issue.storyPoints !== null &&
            issue.storyPoints !== undefined &&
            (pointsAreRating(board) ? (
              <span className="card-badge card-rating" title={fieldName(board, 'storyPoints')}>
                <Icon name="star" size={12} />
                {issue.storyPoints}
              </span>
            ) : (
              <span className="points" title={fieldName(board, 'storyPoints')}>
                {issue.storyPoints}
              </span>
            ))}
          <PriorityIcon priority={issue.priority} name={priorityLabel(board, issue.priority)} />
          <Avatar info={assignee} size={24} title={assignee ? undefined : nobodyLabel(board)} />
        </span>
      </div>
    </div>
  );
});
