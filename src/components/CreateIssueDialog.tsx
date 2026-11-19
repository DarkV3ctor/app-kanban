import { useState } from 'react';
import type { IssueDraft } from '../types';
import { useApp, useDiscardGuard } from '../app-context';
import { t } from '../i18n';
import { isEpic, newIssueDraft } from '../lib/issues';
import { fieldName } from '../lib/fields';
import { columnCategory, uid } from '../lib/utils';
import { useBoard } from './board-context';
import { Field, Modal } from './ui';
import { MarkdownEditor } from './markdown';
import { AssigneePicker, ComponentsPicker, EpicPicker, LabelsPicker, PriorityPicker, StatusPicker, TypePicker, VersionPicker } from './IssueFields';

export function CreateIssueDialog({ defaults, onClose }: { defaults: Partial<IssueDraft>; onClose: () => void }) {
  const { store, user, run, toast } = useApp();
  const { board, issues, openIssue } = useBoard();
  const [d, setD] = useState<IssueDraft>(() => newIssueDraft(board, user, defaults));
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<IssueDraft>) => setD((x) => ({ ...x, ...patch }));

  /** Switching the type swaps the description/checklist template unless the user has edited them. */
  const changeType = (type: string) => {
    const prev = board.issueTypes.find((x) => x.id === d.type);
    const next = board.issueTypes.find((x) => x.id === type);
    const patch: Partial<IssueDraft> = { type };
    if (!d.description.trim() || d.description === (prev?.template ?? '')) patch.description = next?.template ?? '';
    const prevDefault = (prev?.checklist ?? []).join('\n');
    if (!d.checklist.length || d.checklist.map((c) => c.text).join('\n') === prevDefault) {
      patch.checklist = (next?.checklist ?? []).map((text) => ({ id: uid(8), text, done: false }));
    }
    if (next?.isEpic) patch.epicId = null;
    set(patch);
  };

  const submit = async () => {
    if (!d.title.trim()) return;
    setBusy(true);
    const inCol = issues.filter((i) => i.status === d.status);
    const draft: IssueDraft = {
      ...d,
      title: d.title.trim(),
      rank: inCol.length ? Math.max(...inCol.map((i) => i.rank)) + 1000 : 1000,
      resolvedAt: columnCategory(board, d.status) === 'done' ? Date.now() : null,
    };
    const created = await run(store.createIssue(board.id, user, draft));
    setBusy(false);
    if (!created) return;
    toast(t('Created {key}', { key: `${board.key}-${created.number}` }), 'success');
    if (more) {
      setD(newIssueDraft(board, user, { ...defaults, type: d.type, status: d.status, fixVersionId: d.fixVersionId, epicId: d.epicId, assigneeId: d.assigneeId }));
    } else {
      onClose();
      if (defaults.epicId) openIssue(created);
    }
  };

  const typeIsEpic = isEpic(board, d);

  // Escape, the backdrop and the close button ask before a typed title or description is lost.
  const canDiscard = useDiscardGuard();
  const template = board.issueTypes.find((x) => x.id === d.type)?.template ?? '';
  const dirty = d.title.trim() !== '' || d.description.trim() !== template.trim();
  const requestClose = async () => {
    if (await canDiscard(dirty)) onClose();
  };

  return (
    <Modal
      title={t('Create issue')}
      onClose={requestClose}
      size="lg"
      footer={
        <>
          <label className="check-row footer-check">
            <input type="checkbox" checked={more} onChange={(e) => setMore(e.target.checked)} /> {t('Create another')}
          </label>
          <button className="btn btn-subtle" onClick={onClose}>
            {t('Cancel')}
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={busy || !d.title.trim()}>
            {t('Create')}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label={fieldName(board, 'type')}>
          <TypePicker board={board} value={d.type} onChange={changeType} />
        </Field>
        <Field label={t('Status')}>
          <StatusPicker board={board} value={d.status} onChange={(s) => set({ status: s })} />
        </Field>
      </div>
      <Field label={t('Summary *')}>
        <input
          className="input input-lg"
          autoFocus
          value={d.title}
          onChange={(e) => set({ title: e.target.value })}
          placeholder={t('Briefly: what needs to be done')}
          maxLength={500}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), submit())}
        />
      </Field>
      <Field label={t('Description')}>
        <MarkdownEditor value={d.description} onChange={(v) => set({ description: v })} minRows={5} />
      </Field>
      {d.checklist.length > 0 && (
        <div className="field">
          <span className="field-label">{t('Checklist from the issue type template')}</span>
          <div className="chips">
            {d.checklist.map((c) => (
              <span key={c.id} className="chip chip-neutral">
                ☐ {c.text}
              </span>
            ))}
            <button className="btn btn-link btn-sm" onClick={() => set({ checklist: [] })}>
              {t('remove')}
            </button>
          </div>
        </div>
      )}
      <div className="form-grid">
        <Field label={fieldName(board, 'assigneeId')}>
          <AssigneePicker board={board} value={d.assigneeId} onChange={(v) => set({ assigneeId: v })} meId={user.ghId} />
        </Field>
        <Field label={fieldName(board, 'priority')}>
          <PriorityPicker value={d.priority} onChange={(p) => set({ priority: p })} />
        </Field>
        <Field label={fieldName(board, 'labels')}>
          <LabelsPicker board={board} issues={issues} value={d.labels} onChange={(l) => set({ labels: l })} />
        </Field>
        <Field label={fieldName(board, 'components')}>
          <ComponentsPicker board={board} value={d.components} onChange={(c) => set({ components: c })} />
        </Field>
        <Field label={fieldName(board, 'fixVersionId')}>
          <VersionPicker board={board} value={d.fixVersionId} onChange={(v) => set({ fixVersionId: v })} />
        </Field>
        {!typeIsEpic && (
          <Field label={fieldName(board, 'epicId')}>
            <EpicPicker board={board} issues={issues} value={d.epicId} onChange={(v) => set({ epicId: v })} />
          </Field>
        )}
        <Field label={fieldName(board, 'storyPoints')}>
          <input
            className="input"
            inputMode="decimal"
            value={d.storyPoints ?? ''}
            onChange={(e) => set({ storyPoints: e.target.value === '' ? null : Number(e.target.value.replace(',', '.')) || 0 })}
            placeholder="—"
          />
        </Field>
        <Field label={fieldName(board, 'dueDate')}>
          <input className="input" type="date" value={d.dueDate ?? ''} onChange={(e) => set({ dueDate: e.target.value || null })} />
        </Field>
        <Field label={fieldName(board, 'estimate')}>
          <input className="input" value={d.estimate} onChange={(e) => set({ estimate: e.target.value })} placeholder={t('e.g. 2d 4h')} maxLength={50} />
        </Field>
      </div>
    </Modal>
  );
}
