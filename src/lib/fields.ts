import type { Board, FieldKey, Priority } from '../types';
import { t, tk } from '../i18n';
import { TEMPLATES } from '../templates';
import { FIELD_NAME_KEYS } from './normalize';
import { priorityName } from './utils';

/**
 * Field names. Every kind of board names the issue fields its own way ("Milestone" in game dev,
 * "Month" and "Who does it" at home), and admins can rename any of them in the board settings.
 * Lookup order: the board's own name → the name its template gives → the generic name.
 * Template names are in the viewer's language; custom names are shown as typed.
 */

export { MAX_FIELD_NAME, MAX_COVER_DATA, MAX_COVER_URL } from './normalize';

/** Longest build text. Keep in sync with validIssue() in firestore.rules. */
export const MAX_BUILD = 100;

/** The renamable fields, in the order of the issue dialog. */
export const FIELDS: { key: FieldKey; name: string }[] = [
  { key: 'details', name: tk('Details') },
  { key: 'cover', name: tk('Cover') },
  { key: 'assigneeId', name: tk('Assignee') },
  { key: 'reporterId', name: tk('Reporter') },
  { key: 'priority', name: tk('Priority') },
  { key: 'type', name: tk('Type') },
  { key: 'releaseDate', name: tk('Release date') },
  { key: 'labels', name: tk('Labels') },
  { key: 'components', name: tk('Components') },
  { key: 'fixVersionId', name: tk('Fix version') },
  { key: 'build', name: tk('Build') },
  { key: 'epicId', name: tk('Epic') },
  { key: 'storyPoints', name: tk('Story points') },
  { key: 'estimate', name: tk('Estimate') },
  { key: 'dueDate', name: tk('Due date') },
];

/** Fields that only boards made from some templates have (listed in the template's extraFields). */
const OPTIONAL_FIELDS: readonly FieldKey[] = ['build', 'cover', 'releaseDate'];

export function isFieldKey(v: string): v is FieldKey {
  return (FIELD_NAME_KEYS as readonly string[]).includes(v);
}

const templateOf = (board: Pick<Board, 'template'>) => TEMPLATES.find((x) => x.id === board.template);

/** Whether this board has the field (the build, for example, exists only on game dev boards). */
export function hasField(board: Pick<Board, 'template'>, key: FieldKey): boolean {
  return !OPTIONAL_FIELDS.includes(key) || !!templateOf(board)?.extraFields?.includes(key);
}

/**
 * Whether the story points of this board are a rating (a score per issue, as on media boards)
 * rather than an amount of work: then they are not added up, and cards show them with a star.
 */
export function pointsAreRating(board: Pick<Board, 'template'>): boolean {
  return !!templateOf(board)?.pointsAreRating;
}

/** A priority level as this board calls it ("Can't wait" for an interest on media boards). */
export function priorityLabel(board: Pick<Board, 'template'>, p: Priority | string): string {
  return templateOf(board)?.values?.priority?.[p as Priority] ?? priorityName(p);
}

/** An empty assignee as this board calls it ("Nobody yet" on media boards). */
export function nobodyLabel(board: Pick<Board, 'template'>): string {
  return templateOf(board)?.values?.nobody ?? t('Unassigned');
}

/** The button that makes you the assignee ("For me" on media boards). */
export function assignToMeLabel(board: Pick<Board, 'template'>): string {
  return templateOf(board)?.values?.me ?? t('Assign to me');
}

/** The example shown in an empty field: the template's own one, else the given generic one. */
export function fieldHint(board: Pick<Board, 'template'>, key: FieldKey, generic: string): string {
  return templateOf(board)?.hints?.[key] ?? generic;
}

/** The name before any renaming: the generic one, in the viewer's language. */
export function genericFieldName(key: FieldKey): string {
  return t(FIELDS.find((f) => f.key === key)!.name);
}

/** The name a board gets from its template (or the generic one). */
export function defaultFieldName(template: string, key: FieldKey): string {
  return TEMPLATES.find((x) => x.id === template)?.fields[key] ?? genericFieldName(key);
}

/** The name to show for a field on this board. */
export function fieldName(board: Pick<Board, 'template' | 'fieldNames'>, key: FieldKey): string {
  return board.fieldNames[key] || defaultFieldName(board.template, key);
}
