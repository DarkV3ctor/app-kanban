import type { TemplateTexts } from '../templates';

// English text for board templates.

const BUG = `### Steps to reproduce
1.
2.
3.

### Expected result


### Actual result


### Environment
- **Build / version:**
- **Platform:** PC / Console / Mobile
- **Frequency:** always / sometimes / once

### Logs, screenshots, video
`;

const FEATURE = `### Why
Which player problem it solves / what experience it creates.

### What to do
-

### Definition of done
- [ ] Works in a build
- [ ] Covered by a playtest
- [ ] No new errors in the logs

### Links
- Design doc:
`;

const ART = `### Asset
- **Type:** character / environment / UI / VFX / icon
- **Style / references:**
- **Resolution / poly count:**
- **Export format:**

### Where it is used
`;

const AUDIO = `### Sound
- **Type:** SFX / music / voice-over / ambience
- **Mood / references:**
- **Length / loop:**
- **Trigger:**
`;

const LEVEL = `### Level
- **Player goal:**
- **New mechanics:**
- **Approximate length:**
- **Key beats / events:**

### Layout
(link to the blockout or a sketch)
`;

const DESIGN = `### Mechanic / system
Short description.

### Rules
-

### Balance and parameters
| Parameter | Value |
|---|---|
|  |  |

### Open questions
-
`;

const TECH_DEBT = `### Problem
What is wrong now and how it gets in the way.

### Proposed solution


### Risks
`;

export const EN_TEMPLATES: TemplateTexts = {
  gamedev: {
    name: 'Game development',
    description: 'Features, bugs, art, audio, level design, playtests and milestones from prototype to release.',
    columns: { backlog: 'Backlog', todo: 'To do', progress: 'In progress', review: 'Review', qa: 'QA / Playtest', done: 'Done' },
    types: {
      epic: { name: 'Epic', template: '### Goal\n\n### Scope\n- \n\n### Done when\n- ' },
      feature: { name: 'Feature', template: FEATURE, checklist: ['Design approved', 'Implementation', 'Code review', 'Playtest'] },
      bug: { name: 'Bug', template: BUG, checklist: ['Reproduced', 'Root cause found', 'Fixed', 'Verified in a build'] },
      task: { name: 'Task' },
      art: { name: 'Art', template: ART, checklist: ['Sketch', 'Concept approved', 'Final asset', 'Imported into the engine'] },
      audio: { name: 'Audio', template: AUDIO, checklist: ['Draft', 'Final mix', 'Integrated into the engine'] },
      level: { name: 'Level design', template: LEVEL, checklist: ['Blockout', 'Gameplay pass', 'Art pass', 'Lighting', 'Optimization'] },
      design: { name: 'Game design', template: DESIGN },
      techdebt: { name: 'Tech debt', template: TECH_DEBT },
    },
    labels: ['prototype', 'polish', 'crash', 'performance', 'balance', 'localization', 'blocker', 'playtest'],
    components: ['Gameplay', 'Graphics', 'Animation', 'Audio', 'UI/UX', 'AI', 'Networking', 'Physics', 'Narrative', 'Tools', 'Build/CI'],
    versions: {
      proto: { name: 'Prototype', description: 'Core mechanic validated' },
      slice: { name: 'Vertical Slice', description: 'One level at final quality' },
      alpha: { name: 'Alpha', description: 'Feature complete' },
      beta: { name: 'Beta', description: 'Content complete, polish and bug fixing' },
      release: { name: 'Release 1.0', description: 'Store launch' },
    },
    fields: {
      details: 'Production',
      reporterId: 'Reported by',
      type: 'Discipline',
      labels: 'Tags',
      components: 'Game system',
      fixVersionId: 'Milestone',
      dueDate: 'Deadline',
    },
    samples: [
      {
        title: 'Core gameplay loop',
        type: 'epic',
        status: 'progress',
        priority: 'high',
        version: 'v-slice',
        description: '### Goal\nThe player explores a level, gathers resources and upgrades the character.\n\n### Scope\n- Character controls\n- Resource gathering\n- Upgrade shop',
      },
      {
        title: 'Character controller: run, jump, dash',
        type: 'feature',
        status: 'progress',
        priority: 'high',
        version: 'v-slice',
        epic: 'Core gameplay loop',
        components: ['Gameplay'],
        storyPoints: 5,
        estimate: '3d',
        assignToMe: true,
        checklist: [
          ['Design approved', true],
          ['Implementation', true],
          ['Code review', false],
          ['Playtest', false],
        ],
      },
      {
        title: 'Player falls through the floor on level 2',
        type: 'bug',
        status: 'todo',
        priority: 'highest',
        version: 'v-slice',
        components: ['Physics'],
        labels: ['crash', 'blocker'],
        description: BUG.replace('1. \n2. \n3. ', '1. Load level 2\n2. Walk to the bridge\n3. Dash downwards'),
        storyPoints: 2,
      },
      {
        title: 'Main character concept art',
        type: 'art',
        status: 'review',
        priority: 'medium',
        version: 'v-slice',
        components: ['Graphics'],
        storyPoints: 3,
        checklist: [
          ['Sketch', true],
          ['Concept approved', false],
          ['Final asset', false],
          ['Imported into the engine', false],
        ],
      },
      { title: 'Footstep sounds for different surfaces', type: 'audio', status: 'backlog', priority: 'low', version: 'v-alpha', components: ['Audio'], labels: ['polish'] },
      { title: 'Tutorial level blockout', type: 'level', status: 'qa', priority: 'high', version: 'v-slice', epic: 'Core gameplay loop', components: ['Gameplay'], labels: ['playtest'], storyPoints: 5, dueInDays: 5 },
      { title: 'Save system: format and migrations', type: 'techdebt', status: 'backlog', priority: 'medium', version: 'v-alpha', components: ['Tools'] },
      { title: 'Upgrade shop economy balance', type: 'design', status: 'todo', priority: 'medium', version: 'v-alpha', epic: 'Core gameplay loop', labels: ['balance'] },
      { title: 'Main menu and pause screen', type: 'feature', status: 'done', priority: 'medium', version: 'v-proto', components: ['UI/UX'], storyPoints: 3 },
    ],
  },

  home: {
    name: 'Home & life',
    description: 'Chores, shopping, repairs, finances, health and events — for yourself or the whole family.',
    columns: { ideas: 'Ideas', planned: 'Planned', week: 'This week', doing: 'In progress', waiting: 'Waiting', done: 'Done' },
    types: {
      goal: { name: 'Goal', template: '### What I want to achieve\n\n### Steps\n- \n\n### By when\n' },
      chore: { name: 'Chore' },
      shopping: { name: 'Shopping', template: '- **Where to buy:** \n- **Budget:** \n' },
      repair: { name: 'Repair', template: '### What is broken / what to do\n\n\n### What you need\n- \n\n### Handyman / contacts\n- \n\n### Budget\n- \n' },
      finance: { name: 'Finance', template: '- **Amount:** \n- **Due date:** \n- **How to pay:** \n- **Receipt:** \n' },
      health: { name: 'Health', template: '- **Doctor / clinic:** \n- **Date and time:** \n- **What to bring:** \n- **Results / prescriptions:** \n' },
      event: { name: 'Event', template: '- **When:** \n- **Where:** \n- **Who is coming:** \n- **What to prepare:** \n' },
      learn: { name: 'Learning / hobby' },
    },
    labels: ['urgent', 'recurring', 'together', 'weekend', 'budget'],
    components: ['Kitchen', 'Bathroom', 'Living room', 'Bedroom', 'Garden', 'Car', 'Kids', 'Pets', 'Documents'],
    versions: {},
    monthDescription: 'Things to do this month',
    fields: {
      details: 'About this task',
      assigneeId: 'Who does it',
      reporterId: 'Added by',
      priority: 'Importance',
      type: 'Category',
      components: 'Room / area',
      fixVersionId: 'Month',
      epicId: 'Goal',
      storyPoints: 'Effort',
      estimate: 'Time needed',
      dueDate: 'By when',
    },
    samples: [
      { title: 'Get ready for the holidays', type: 'goal', status: 'planned', priority: 'medium', version: '$m1' },
      {
        title: 'Weekly groceries',
        type: 'shopping',
        status: 'week',
        priority: 'high',
        components: ['Kitchen'],
        labels: ['recurring'],
        dueInDays: 1,
        assignToMe: true,
        checklist: [
          ['Milk', false],
          ['Bread', true],
          ['Vegetables', false],
          ['Chicken', false],
          ['Coffee', false],
        ],
      },
      {
        title: 'Fix the dripping kitchen tap',
        type: 'repair',
        status: 'doing',
        priority: 'high',
        components: ['Kitchen'],
        version: '$m0',
        estimate: '2h',
        checklist: [
          ['Buy a cartridge', true],
          ['Shut off the water', false],
          ['Replace the cartridge', false],
        ],
      },
      { title: 'Pay utility bills', type: 'finance', status: 'week', priority: 'highest', labels: ['recurring', 'urgent'], version: '$m0', dueInDays: 3 },
      { title: 'Book a dentist appointment', type: 'health', status: 'planned', priority: 'medium', version: '$m0' },
      { title: 'Presents for the family', type: 'shopping', status: 'ideas', priority: 'medium', epic: 'Get ready for the holidays', version: '$m1', labels: ['together'] },
      {
        title: 'Deep cleaning',
        type: 'chore',
        status: 'planned',
        priority: 'low',
        epic: 'Get ready for the holidays',
        version: '$m1',
        labels: ['weekend', 'together'],
        checklist: [
          ['Windows', false],
          ['Cupboards', false],
          ['Balcony', false],
        ],
      },
      { title: 'Waiting for the vacuum cleaner delivery', type: 'shopping', status: 'waiting', priority: 'low', components: ['Living room'] },
      { title: 'Switch to winter tyres', type: 'chore', status: 'done', priority: 'high', components: ['Car'], version: '$m0' },
      { title: 'Take an online photography course', type: 'learn', status: 'ideas', priority: 'lowest' },
    ],
  },

  software: {
    name: 'Software development',
    description: 'Classic Jira workflow: stories, tasks, bugs, epics, code review and releases.',
    columns: { todo: 'To do', progress: 'In progress', review: 'In review', done: 'Done' },
    types: {
      epic: { name: 'Epic' },
      story: { name: 'Story', template: '**As a** <role>, **I want** <action>, **so that** <value>.\n\n### Acceptance criteria\n- [ ] \n' },
      task: { name: 'Task' },
      bug: { name: 'Bug', template: '### Steps to reproduce\n1. \n\n### Expected result\n\n\n### Actual result\n\n\n### Environment\n- Version: \n- OS / browser: \n' },
    },
    labels: ['frontend', 'backend', 'devops', 'ux', 'security'],
    components: ['API', 'Web', 'Mobile', 'Infrastructure'],
    versions: {
      v1: { name: '1.0', description: '' },
      v1_1: { name: '1.1', description: '' },
    },
    fields: {
      details: 'Issue details',
      components: 'Component',
      fixVersionId: 'Release',
      estimate: 'Original estimate',
    },
    samples: [
      { title: 'Sign-up and login', type: 'epic', status: 'progress', version: 'v1' },
      { title: 'As a user, I want to sign in with GitHub', type: 'story', status: 'progress', epic: 'Sign-up and login', version: 'v1', storyPoints: 3, assignToMe: true },
      { title: 'Log out button does not work in Safari', type: 'bug', status: 'todo', priority: 'high', version: 'v1', storyPoints: 1 },
      { title: 'Set up CI for pull requests', type: 'task', status: 'done', components: ['Infrastructure'], version: 'v1' },
    ],
  },

  blank: {
    name: 'Blank board',
    description: 'Three columns and basic issue types — customize everything to fit.',
    columns: { todo: 'To do', progress: 'In progress', done: 'Done' },
    types: { epic: { name: 'Epic' }, task: { name: 'Task' }, bug: { name: 'Bug' } },
    labels: [],
    components: [],
    versions: {},
    samples: [],
  },
};
