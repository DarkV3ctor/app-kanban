import type { Board, FieldKey } from '../types';
import { t, tk } from '../i18n';
import { TEMPLATES } from '../templates';
import { FIELD_NAME_KEYS } from './normalize';

/**
 * Field names. Every kind of board names the issue fields its own way ("Milestone" in game dev,
 * "Month" and "Who does it" at home), and admins can rename any of them in the board settings.
 * Lookup order: the board's own name → the name its template gives → the generic name.
 * Template names are in the viewer's language; custom names are shown as typed.
 */

export { MAX_FIELD_NAME } from './normalize';

/** The renamable fields, in the order of the issue dialog. */
export const FIELDS: { key: FieldKey; name: string }[] = [
  { key: 'details', name: tk('Details') },
  { key: 'assigneeId', name: tk('Assignee') },
  { key: 'reporterId', name: tk('Reporter') },
  { key: 'priority', name: tk('Priority') },
  { key: 'type', name: tk('Type') },
  { key: 'labels', name: tk('Labels') },
  { key: 'components', name: tk('Components') },
  { key: 'fixVersionId', name: tk('Fix version') },
  { key: 'epicId', name: tk('Epic') },
  { key: 'storyPoints', name: tk('Story points') },
  { key: 'estimate', name: tk('Estimate') },
  { key: 'dueDate', name: tk('Due date') },
];

export function isFieldKey(v: string): v is FieldKey {
  return (FIELD_NAME_KEYS as readonly string[]).includes(v);
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
