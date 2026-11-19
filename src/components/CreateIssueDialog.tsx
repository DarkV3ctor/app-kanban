import { useState } from 'react';
import type { IssueDraft } from '../types';
import { useApp } from '../app-context';
import { isEpic, newIssueDraft } from '../lib/issues';
import { columnCategory, uid } from '../lib/utils';
import { useBoard } from './board-context';
import { Field, MarkdownEditor, Modal } from './ui';
import { AssigneePicker, ComponentsPicker, EpicPicker, LabelsPicker, PriorityPicker, StatusPicker, TypePicker, VersionPicker } from './IssueFields';

export function CreateIssueDialog({ defaults, onClose }: { defaults: Partial<IssueDraft>; onClose: () => void }) {
  const { store, user, run, toast } = useApp();
  const { board, issues, openIssue } = useBoard();
  const [d, setD] = useState<IssueDraft>(() => newIssueDraft(board, user, defaults));
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<IssueDraft>) => setD((x) => ({ ...x, ...patch }));

  const changeType = (type: string) => {
    const prev = board.issueTypes.find((t) => t.id === d.type);
    const next = board.issueTypes.find((t) => t.id === type);
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
    toast(`Создана задача ${board.key}-${created.number}`, 'success');
    if (more) {
      setD(newIssueDraft(board, user, { ...defaults, type: d.type, status: d.status, fixVersionId: d.fixVersionId, epicId: d.epicId, assigneeId: d.assigneeId }));
    } else {
      onClose();
      if (defaults.epicId) openIssue(created);
    }
  };

  const typeIsEpic = isEpic(board, d);

  return (
    <Modal
      title="Создать задачу"
      onClose={onClose}
      size="lg"
      footer={
        <>
          <label className="check-row footer-check">
            <input type="checkbox" checked={more} onChange={(e) => setMore(e.target.checked)} /> Создать ещё
          </label>
          <button className="btn btn-subtle" onClick={onClose}>
            Отмена
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={busy || !d.title.trim()}>
            Создать
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Тип задачи">
          <TypePicker board={board} value={d.type} onChange={changeType} />
        </Field>
        <Field label="Статус">
          <StatusPicker board={board} value={d.status} onChange={(s) => set({ status: s })} />
        </Field>
      </div>
      <Field label="Название *">
        <input
          className="input input-lg"
          autoFocus
          value={d.title}
          onChange={(e) => set({ title: e.target.value })}
          placeholder="Кратко: что нужно сделать"
          maxLength={255}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), submit())}
        />
      </Field>
      <Field label="Описание">
        <MarkdownEditor value={d.description} onChange={(v) => set({ description: v })} minRows={5} />
      </Field>
      {d.checklist.length > 0 && (
        <div className="field">
          <span className="field-label">Чек-лист из шаблона типа</span>
          <div className="chips">
            {d.checklist.map((c) => (
              <span key={c.id} className="chip chip-neutral">
                ☐ {c.text}
              </span>
            ))}
            <button className="btn btn-link btn-sm" onClick={() => set({ checklist: [] })}>
              убрать
            </button>
          </div>
        </div>
      )}
      <div className="form-grid">
        <Field label="Исполнитель">
          <AssigneePicker board={board} value={d.assigneeId} onChange={(v) => set({ assigneeId: v })} meId={user.ghId} />
        </Field>
        <Field label="Приоритет">
          <PriorityPicker value={d.priority} onChange={(p) => set({ priority: p })} />
        </Field>
        <Field label="Метки">
          <LabelsPicker board={board} issues={issues} value={d.labels} onChange={(l) => set({ labels: l })} />
        </Field>
        <Field label="Компоненты">
          <ComponentsPicker board={board} value={d.components} onChange={(c) => set({ components: c })} />
        </Field>
        <Field label="Версия">
          <VersionPicker board={board} value={d.fixVersionId} onChange={(v) => set({ fixVersionId: v })} />
        </Field>
        {!typeIsEpic && (
          <Field label="Эпик">
            <EpicPicker board={board} issues={issues} value={d.epicId} onChange={(v) => set({ epicId: v })} />
          </Field>
        )}
        <Field label="Story points">
          <input className="input" inputMode="decimal" value={d.storyPoints ?? ''} onChange={(e) => set({ storyPoints: e.target.value === '' ? null : Number(e.target.value.replace(',', '.')) || 0 })} placeholder="—" />
        </Field>
        <Field label="Срок">
          <input className="input" type="date" value={d.dueDate ?? ''} onChange={(e) => set({ dueDate: e.target.value || null })} />
        </Field>
        <Field label="Оценка">
          <input className="input" value={d.estimate} onChange={(e) => set({ estimate: e.target.value })} placeholder="напр. 2d 4h" />
        </Field>
      </div>
    </Modal>
  );
}
