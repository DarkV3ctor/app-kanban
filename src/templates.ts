import type { BoardSetup, Column, FieldKey, FieldNames, IssueType, Priority, Version } from './types';
import { lang } from './i18n';
import { addDays, monthName, todayISO, toISODate, uid } from './lib/utils';
import { EN_TEMPLATES } from './locales/templates.en';
import { UK_TEMPLATES } from './locales/templates.uk';

/**
 * Board templates. The structure (ids, categories, icons, colors, dates) lives here;
 * all user-visible text comes from src/locales/templates.<lang>.ts.
 */

export interface SampleIssue {
  title: string;
  type: string; // issue type id
  status: string; // column id
  priority?: Priority;
  description?: string;
  labels?: string[];
  components?: string[];
  version?: string; // version id ('$m0', '$m1'… = generated months)
  build?: string;
  epic?: string; // title of an epic from the same list
  storyPoints?: number;
  estimate?: string;
  dueInDays?: number;
  checklist?: [string, boolean][];
  assignToMe?: boolean;
}

export interface TypeText {
  name: string;
  template?: string;
  checklist?: string[];
}

export interface TemplateContent<C extends string, T extends string, V extends string = never> {
  name: string;
  description: string;
  columns: Record<C, string>;
  types: Record<T, TypeText>;
  labels: string[];
  components: string[];
  versions: Record<V, { name: string; description: string }>;
  /** Names of the issue fields that suit this kind of board (the rest keep the generic names). */
  fields?: FieldNames;
  samples: SampleIssue[];
}

export interface TemplateTexts {
  gamedev: TemplateContent<'backlog' | 'todo' | 'progress' | 'review' | 'qa' | 'done', 'epic' | 'feature' | 'bug' | 'task' | 'art' | 'audio' | 'level' | 'design' | 'techdebt', 'proto' | 'slice' | 'alpha' | 'beta' | 'release'>;
  home: TemplateContent<'ideas' | 'planned' | 'week' | 'doing' | 'waiting' | 'done', 'goal' | 'chore' | 'shopping' | 'repair' | 'finance' | 'health' | 'event' | 'learn'> & { monthDescription: string };
  software: TemplateContent<'todo' | 'progress' | 'review' | 'done', 'epic' | 'story' | 'task' | 'bug', 'v1' | 'v1_1'>;
  blank: TemplateContent<'todo' | 'progress' | 'done', 'epic' | 'task' | 'bug'>;
}

export interface BoardTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  defaultKey: string;
  /** Field names of boards made from this template, in the UI language (see fieldName()). */
  fields: FieldNames;
  /** Fields that only boards of this kind have (see OPTIONAL_FIELDS in lib/fields.ts). */
  extraFields?: FieldKey[];
  build: () => { draft: BoardSetup; samples: SampleIssue[] };
}

const TEXT: TemplateTexts = lang === 'uk' ? UK_TEMPLATES : EN_TEMPLATES;

const col = (id: string, name: string, category: Column['category'], wip = 0): Column => ({ id, name, category, wip });

function type(text: TypeText, id: string, icon: string, color: string, isEpic = false): IssueType {
  const it: IssueType = { id, name: text.name, icon, color };
  if (isEpic) it.isEpic = true;
  if (text.template) it.template = text.template;
  if (text.checklist?.length) it.checklist = text.checklist;
  return it;
}

function version(id: string, text: { name: string; description: string }, status: Version['status'], startDate: string | null, releaseDate: string | null): Version {
  return { id, name: text.name, description: text.description, status, startDate, releaseDate };
}

// ---------------------------------------------------------------------------
// Game development
// ---------------------------------------------------------------------------

const gameDev: BoardTemplate = {
  id: 'gamedev',
  name: TEXT.gamedev.name,
  description: TEXT.gamedev.description,
  fields: TEXT.gamedev.fields ?? {},
  extraFields: ['build'],
  icon: '🎮',
  color: '#6E5DC6',
  defaultKey: 'GAME',
  build: () => {
    const x = TEXT.gamedev;
    const t = todayISO();
    return {
      draft: {
        template: 'gamedev',
        icon: '🎮',
        color: '#6E5DC6',
        columns: [
          col('backlog', x.columns.backlog, 'todo'),
          col('todo', x.columns.todo, 'todo'),
          col('progress', x.columns.progress, 'progress', 5),
          col('review', x.columns.review, 'progress'),
          col('qa', x.columns.qa, 'progress'),
          col('done', x.columns.done, 'done'),
        ],
        issueTypes: [
          type(x.types.epic, 'epic', 'epic', '#904EE2', true),
          type(x.types.feature, 'feature', 'story', '#22A06B'),
          type(x.types.bug, 'bug', 'bug', '#E2483D'),
          type(x.types.task, 'task', 'task', '#1D7AFC'),
          type(x.types.art, 'art', 'art', '#CD519D'),
          type(x.types.audio, 'audio', 'audio', '#1D9AAA'),
          type(x.types.level, 'level', 'map', '#E56910'),
          type(x.types.design, 'design', 'puzzle', '#B38600'),
          type(x.types.techdebt, 'techdebt', 'gear', '#626F86'),
        ],
        labels: x.labels,
        components: x.components,
        versions: [
          version('v-proto', x.versions.proto, 'released', addDays(t, -45), addDays(t, -10)),
          version('v-slice', x.versions.slice, 'unreleased', addDays(t, -10), addDays(t, 30)),
          version('v-alpha', x.versions.alpha, 'unreleased', null, addDays(t, 90)),
          version('v-beta', x.versions.beta, 'unreleased', null, addDays(t, 150)),
          version('v-1-0', x.versions.release, 'unreleased', null, addDays(t, 210)),
        ],
        fieldNames: {},
      },
      samples: x.samples,
    };
  },
};

// ---------------------------------------------------------------------------
// Home & life
// ---------------------------------------------------------------------------

/** Versions for the current and the next two months. */
function monthVersions(description: string): Version[] {
  const now = new Date();
  const res: Version[] = [];
  for (let i = 0; i < 3; i++) {
    const start = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
    res.push({
      id: `m-${start.getFullYear()}-${start.getMonth() + 1}`,
      name: `${monthName(start)} ${start.getFullYear()}`,
      description,
      status: 'unreleased',
      startDate: toISODate(start),
      releaseDate: toISODate(end),
    });
  }
  return res;
}

const home: BoardTemplate = {
  id: 'home',
  name: TEXT.home.name,
  description: TEXT.home.description,
  fields: TEXT.home.fields ?? {},
  icon: '🏠',
  color: '#22A06B',
  defaultKey: 'HOME',
  build: () => {
    const x = TEXT.home;
    const versions = monthVersions(x.monthDescription);
    const monthIds: Record<string, string> = { $m0: versions[0].id, $m1: versions[1].id, $m2: versions[2].id };
    return {
      draft: {
        template: 'home',
        icon: '🏠',
        color: '#22A06B',
        columns: [
          col('ideas', x.columns.ideas, 'todo'),
          col('planned', x.columns.planned, 'todo'),
          col('week', x.columns.week, 'todo', 7),
          col('doing', x.columns.doing, 'progress', 3),
          col('waiting', x.columns.waiting, 'progress'),
          col('done', x.columns.done, 'done'),
        ],
        issueTypes: [
          type(x.types.goal, 'goal', 'flag', '#904EE2', true),
          type(x.types.chore, 'chore', 'task', '#1D7AFC'),
          type(x.types.shopping, 'shopping', 'cart', '#22A06B'),
          type(x.types.repair, 'repair', 'wrench', '#E56910'),
          type(x.types.finance, 'finance', 'coin', '#B38600'),
          type(x.types.health, 'health', 'heart', '#E2483D'),
          type(x.types.event, 'event', 'calendar', '#1D9AAA'),
          type(x.types.learn, 'learn', 'book', '#6E5DC6'),
        ],
        labels: x.labels,
        components: x.components,
        versions,
        fieldNames: {},
      },
      samples: x.samples.map((s) => (s.version && monthIds[s.version] ? { ...s, version: monthIds[s.version] } : s)),
    };
  },
};

// ---------------------------------------------------------------------------
// Software development (Scrum-lite)
// ---------------------------------------------------------------------------

const software: BoardTemplate = {
  id: 'software',
  name: TEXT.software.name,
  description: TEXT.software.description,
  fields: TEXT.software.fields ?? {},
  icon: '💻',
  color: '#1D7AFC',
  defaultKey: 'DEV',
  build: () => {
    const x = TEXT.software;
    const t = todayISO();
    return {
      draft: {
        template: 'software',
        icon: '💻',
        color: '#1D7AFC',
        columns: [col('todo', x.columns.todo, 'todo'), col('progress', x.columns.progress, 'progress', 4), col('review', x.columns.review, 'progress'), col('done', x.columns.done, 'done')],
        issueTypes: [
          type(x.types.epic, 'epic', 'epic', '#904EE2', true),
          type(x.types.story, 'story', 'story', '#22A06B'),
          type(x.types.task, 'task', 'task', '#1D7AFC'),
          type(x.types.bug, 'bug', 'bug', '#E2483D'),
        ],
        labels: x.labels,
        components: x.components,
        versions: [version('v1', x.versions.v1, 'unreleased', t, addDays(t, 14)), version('v1-1', x.versions.v1_1, 'unreleased', addDays(t, 14), addDays(t, 28))],
        fieldNames: {},
      },
      samples: x.samples,
    };
  },
};

// ---------------------------------------------------------------------------
// Blank
// ---------------------------------------------------------------------------

const blank: BoardTemplate = {
  id: 'blank',
  name: TEXT.blank.name,
  description: TEXT.blank.description,
  fields: TEXT.blank.fields ?? {},
  icon: '📋',
  color: '#626F86',
  defaultKey: 'KB',
  build: () => {
    const x = TEXT.blank;
    return {
      draft: {
        template: 'blank',
        icon: '📋',
        color: '#626F86',
        columns: [col('todo', x.columns.todo, 'todo'), col('progress', x.columns.progress, 'progress'), col('done', x.columns.done, 'done')],
        issueTypes: [type(x.types.epic, 'epic', 'epic', '#904EE2', true), type(x.types.task, 'task', 'task', '#1D7AFC'), type(x.types.bug, 'bug', 'bug', '#E2483D')],
        labels: x.labels,
        components: x.components,
        versions: [],
        fieldNames: {},
      },
      samples: x.samples,
    };
  },
};

export const TEMPLATES: BoardTemplate[] = [gameDev, home, software, blank];

export function newColumnId(): string {
  return 'c-' + uid(6);
}
