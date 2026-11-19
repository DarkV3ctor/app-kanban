import type { BoardDraft, Column, IssueType, Priority, Version } from './types';
import { MONTHS_NOM, addDays, todayISO, uid } from './lib/utils';

export interface SampleIssue {
  title: string;
  type: string; // id типа
  status: string; // id колонки
  priority?: Priority;
  description?: string;
  labels?: string[];
  components?: string[];
  version?: string; // id версии
  epic?: string; // title эпика из этого же списка
  storyPoints?: number;
  estimate?: string;
  dueInDays?: number;
  checklist?: [string, boolean][];
  assignToMe?: boolean;
}

export interface BoardTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  defaultKey: string;
  build: () => { draft: Omit<BoardDraft, 'name' | 'key' | 'description'>; samples: SampleIssue[] };
}

const col = (id: string, name: string, category: Column['category'], wip = 0): Column => ({ id, name, category, wip });

const ver = (id: string, name: string, status: Version['status'] = 'unreleased', description = '', startDate: string | null = null, releaseDate: string | null = null): Version => ({
  id,
  name,
  description,
  status,
  startDate,
  releaseDate,
});

// ---------------------------------------------------------------------------
// Шаблоны описаний
// ---------------------------------------------------------------------------

const BUG_TEMPLATE = `### Шаги воспроизведения
1.
2.
3.

### Ожидаемый результат


### Фактический результат


### Окружение
- **Билд / версия:**
- **Платформа:** PC / Console / Mobile
- **Частота:** всегда / иногда / один раз

### Логи, скриншоты, видео
`;

const FEATURE_TEMPLATE = `### Зачем
Какую проблему игрока решает / какой опыт создаёт.

### Что нужно сделать
-

### Критерии готовности
- [ ] Работает в билде
- [ ] Покрыто плейтестом
- [ ] Нет новых ошибок в логах

### Ссылки
- Дизайн-документ:
`;

const ART_TEMPLATE = `### Ассет
- **Тип:** персонаж / окружение / UI / VFX / иконка
- **Стиль / референсы:**
- **Разрешение / полигонаж:**
- **Формат экспорта:**

### Где используется
`;

const AUDIO_TEMPLATE = `### Звук
- **Тип:** SFX / музыка / озвучка / эмбиент
- **Настроение / референсы:**
- **Длительность / луп:**
- **Где срабатывает:**
`;

const LEVEL_TEMPLATE = `### Уровень
- **Цель игрока:**
- **Новые механики:**
- **Примерная длительность:**
- **Ключевые точки / события:**

### Схема
(ссылка на блок-аут или скетч)
`;

const GDD_TEMPLATE = `### Механика / система
Краткое описание.

### Правила
-

### Баланс и параметры
| Параметр | Значение |
|---|---|
|  |  |

### Открытые вопросы
-
`;

const TECH_DEBT_TEMPLATE = `### Проблема
Что сейчас плохо и чем это мешает.

### Предлагаемое решение


### Риски
`;

const STORY_TEMPLATE = `**Как** <роль>, **я хочу** <действие>, **чтобы** <ценность>.

### Критерии приёмки
- [ ]
`;

const SW_BUG_TEMPLATE = `### Шаги воспроизведения
1.

### Ожидаемый результат


### Фактический результат


### Окружение
- Версия:
- ОС / браузер:
`;

const REPAIR_TEMPLATE = `### Что сломалось / что сделать


### Что понадобится
-

### Мастер / контакты
-

### Бюджет
-
`;

const FINANCE_TEMPLATE = `- **Сумма:**
- **Срок оплаты:**
- **Как оплатить:**
- **Квитанция / чек:**
`;

const EVENT_TEMPLATE = `- **Когда:**
- **Где:**
- **Кто участвует:**
- **Что подготовить:**
`;

const HEALTH_TEMPLATE = `- **Врач / клиника:**
- **Дата и время:**
- **Что взять с собой:**
- **Результаты / назначения:**
`;

// ---------------------------------------------------------------------------
// Game Dev
// ---------------------------------------------------------------------------

const gameDev: BoardTemplate = {
  id: 'gamedev',
  name: 'Разработка игры',
  description: 'Фичи, баги, арт, звук, левел-дизайн, плейтесты и вехи от прототипа до релиза.',
  icon: '🎮',
  color: '#6E5DC6',
  defaultKey: 'GAME',
  build: () => {
    const issueTypes: IssueType[] = [
      { id: 'epic', name: 'Эпик', icon: 'epic', color: '#904EE2', isEpic: true, template: '### Цель\n\n### Состав\n- \n\n### Готово, когда\n- ' },
      { id: 'feature', name: 'Фича', icon: 'story', color: '#22A06B', template: FEATURE_TEMPLATE, checklist: ['Дизайн согласован', 'Реализация', 'Код-ревью', 'Плейтест'] },
      { id: 'bug', name: 'Баг', icon: 'bug', color: '#E2483D', template: BUG_TEMPLATE, checklist: ['Воспроизведён', 'Найдена причина', 'Исправлено', 'Проверено в билде'] },
      { id: 'task', name: 'Задача', icon: 'task', color: '#1D7AFC' },
      { id: 'art', name: 'Арт', icon: 'art', color: '#CD519D', template: ART_TEMPLATE, checklist: ['Скетч', 'Концепт утверждён', 'Финальный ассет', 'Импорт в движок'] },
      { id: 'audio', name: 'Звук', icon: 'audio', color: '#1D9AAA', template: AUDIO_TEMPLATE, checklist: ['Черновик', 'Финальный микс', 'Интеграция в движок'] },
      { id: 'level', name: 'Левел-дизайн', icon: 'map', color: '#E56910', template: LEVEL_TEMPLATE, checklist: ['Блок-аут', 'Геймплейный проход', 'Арт-пасс', 'Свет', 'Оптимизация'] },
      { id: 'design', name: 'Геймдизайн', icon: 'puzzle', color: '#B38600', template: GDD_TEMPLATE },
      { id: 'techdebt', name: 'Тех. долг', icon: 'gear', color: '#626F86', template: TECH_DEBT_TEMPLATE },
    ];
    const columns = [
      col('backlog', 'Бэклог', 'todo'),
      col('todo', 'К работе', 'todo'),
      col('progress', 'В работе', 'progress', 5),
      col('review', 'Ревью', 'progress'),
      col('qa', 'Тест / Плейтест', 'progress'),
      col('done', 'Готово', 'done'),
    ];
    const t = todayISO();
    const versions = [
      ver('v-proto', 'Прототип', 'released', 'Проверка основной механики', addDays(t, -45), addDays(t, -10)),
      ver('v-slice', 'Vertical Slice', 'unreleased', 'Один уровень в финальном качестве', addDays(t, -10), addDays(t, 30)),
      ver('v-alpha', 'Alpha', 'unreleased', 'Все фичи реализованы', null, addDays(t, 90)),
      ver('v-beta', 'Beta', 'unreleased', 'Контент готов, полировка и баги', null, addDays(t, 150)),
      ver('v-1-0', 'Релиз 1.0', 'unreleased', 'Выход в магазине', null, addDays(t, 210)),
    ];
    const samples: SampleIssue[] = [
      { title: 'Основной игровой цикл', type: 'epic', status: 'progress', priority: 'high', version: 'v-slice', description: '### Цель\nИгрок исследует уровень, собирает ресурсы и улучшает персонажа.\n\n### Состав\n- Управление персонажем\n- Сбор ресурсов\n- Магазин улучшений' },
      { title: 'Контроллер персонажа: бег, прыжок, рывок', type: 'feature', status: 'progress', priority: 'high', version: 'v-slice', epic: 'Основной игровой цикл', components: ['Геймплей'], storyPoints: 5, estimate: '3d', assignToMe: true, checklist: [['Дизайн согласован', true], ['Реализация', true], ['Код-ревью', false], ['Плейтест', false]] },
      { title: 'Персонаж проваливается сквозь пол на уровне 2', type: 'bug', status: 'todo', priority: 'highest', version: 'v-slice', components: ['Физика'], labels: ['crash', 'blocker'], description: BUG_TEMPLATE.replace('1. \n2. \n3. ', '1. Загрузить уровень 2\n2. Подойти к мосту\n3. Сделать рывок вниз'), storyPoints: 2 },
      { title: 'Концепт-арт главного героя', type: 'art', status: 'review', priority: 'medium', version: 'v-slice', components: ['Графика'], storyPoints: 3, checklist: [['Скетч', true], ['Концепт утверждён', false], ['Финальный ассет', false], ['Импорт в движок', false]] },
      { title: 'Звуки шагов по разным поверхностям', type: 'audio', status: 'backlog', priority: 'low', version: 'v-alpha', components: ['Звук'], labels: ['polish'] },
      { title: 'Блок-аут обучающего уровня', type: 'level', status: 'qa', priority: 'high', version: 'v-slice', epic: 'Основной игровой цикл', components: ['Геймплей'], labels: ['playtest'], storyPoints: 5, dueInDays: 5 },
      { title: 'Система сохранений: формат и миграции', type: 'techdebt', status: 'backlog', priority: 'medium', version: 'v-alpha', components: ['Инструменты'] },
      { title: 'Баланс экономики магазина улучшений', type: 'design', status: 'todo', priority: 'medium', version: 'v-alpha', epic: 'Основной игровой цикл', labels: ['balance'] },
      { title: 'Главное меню и экран паузы', type: 'feature', status: 'done', priority: 'medium', version: 'v-proto', components: ['UI/UX'], storyPoints: 3 },
    ];
    return {
      draft: {
        template: 'gamedev',
        icon: '🎮',
        color: '#6E5DC6',
        columns,
        issueTypes,
        labels: ['prototype', 'polish', 'crash', 'performance', 'balance', 'localization', 'blocker', 'playtest'],
        components: ['Геймплей', 'Графика', 'Анимация', 'Звук', 'UI/UX', 'AI', 'Сеть', 'Физика', 'Нарратив', 'Инструменты', 'Билд/CI'],
        versions,
      },
      samples,
    };
  },
};

// ---------------------------------------------------------------------------
// Дом и жизнь
// ---------------------------------------------------------------------------

function monthVersions(): Version[] {
  const now = new Date();
  const res: Version[] = [];
  for (let i = 0; i < 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    res.push(
      ver(
        `m-${d.getFullYear()}-${d.getMonth() + 1}`,
        `${MONTHS_NOM[d.getMonth()]} ${d.getFullYear()}`,
        'unreleased',
        'Дела на месяц',
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`,
        `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`,
      ),
    );
  }
  return res;
}

const home: BoardTemplate = {
  id: 'home',
  name: 'Дом и жизнь',
  description: 'Домашние дела, покупки, ремонт, финансы, здоровье и события — для себя или всей семьи.',
  icon: '🏠',
  color: '#22A06B',
  defaultKey: 'HOME',
  build: () => {
    const issueTypes: IssueType[] = [
      { id: 'goal', name: 'Цель', icon: 'flag', color: '#904EE2', isEpic: true, template: '### Чего хочу добиться\n\n### Шаги\n- \n\n### К какому сроку\n' },
      { id: 'chore', name: 'Дело', icon: 'task', color: '#1D7AFC' },
      { id: 'shopping', name: 'Покупка', icon: 'cart', color: '#22A06B', template: '- **Где купить:** \n- **Бюджет:** \n', checklist: [] },
      { id: 'repair', name: 'Ремонт', icon: 'wrench', color: '#E56910', template: REPAIR_TEMPLATE },
      { id: 'finance', name: 'Финансы', icon: 'coin', color: '#B38600', template: FINANCE_TEMPLATE },
      { id: 'health', name: 'Здоровье', icon: 'heart', color: '#E2483D', template: HEALTH_TEMPLATE },
      { id: 'event', name: 'Событие', icon: 'calendar', color: '#1D9AAA', template: EVENT_TEMPLATE },
      { id: 'learn', name: 'Учёба / хобби', icon: 'book', color: '#6E5DC6' },
    ];
    const columns = [
      col('ideas', 'Идеи', 'todo'),
      col('planned', 'Запланировано', 'todo'),
      col('week', 'На этой неделе', 'todo', 7),
      col('doing', 'В процессе', 'progress', 3),
      col('waiting', 'Ждём', 'progress'),
      col('done', 'Сделано', 'done'),
    ];
    const versions = monthVersions();
    const m0 = versions[0].id;
    const m1 = versions[1].id;
    const samples: SampleIssue[] = [
      { title: 'Подготовиться к праздникам', type: 'goal', status: 'planned', priority: 'medium', version: m1 },
      { title: 'Продукты на неделю', type: 'shopping', status: 'week', priority: 'high', components: ['Кухня'], labels: ['регулярно'], dueInDays: 1, assignToMe: true, checklist: [['Молоко', false], ['Хлеб', true], ['Овощи', false], ['Курица', false], ['Кофе', false]] },
      { title: 'Починить капающий кран на кухне', type: 'repair', status: 'doing', priority: 'high', components: ['Кухня'], version: m0, estimate: '2h', checklist: [['Купить картридж', true], ['Перекрыть воду', false], ['Заменить картридж', false]] },
      { title: 'Оплатить коммунальные услуги', type: 'finance', status: 'week', priority: 'highest', labels: ['регулярно', 'срочно'], version: m0, dueInDays: 3 },
      { title: 'Записаться к стоматологу', type: 'health', status: 'planned', priority: 'medium', version: m0 },
      { title: 'Подарки родным', type: 'shopping', status: 'ideas', priority: 'medium', epic: 'Подготовиться к праздникам', version: m1, labels: ['вместе'] },
      { title: 'Генеральная уборка', type: 'chore', status: 'planned', priority: 'low', epic: 'Подготовиться к праздникам', version: m1, labels: ['выходные', 'вместе'], checklist: [['Окна', false], ['Шкафы', false], ['Балкон', false]] },
      { title: 'Ждём доставку пылесоса', type: 'shopping', status: 'waiting', priority: 'low', components: ['Гостиная'] },
      { title: 'Поменять резину на зимнюю', type: 'chore', status: 'done', priority: 'high', components: ['Авто'], version: m0 },
      { title: 'Пройти онлайн-курс по фотографии', type: 'learn', status: 'ideas', priority: 'lowest' },
    ];
    return {
      draft: {
        template: 'home',
        icon: '🏠',
        color: '#22A06B',
        columns,
        issueTypes,
        labels: ['срочно', 'регулярно', 'вместе', 'выходные', 'бюджет'],
        components: ['Кухня', 'Ванная', 'Гостиная', 'Спальня', 'Дача / сад', 'Авто', 'Дети', 'Питомцы', 'Документы'],
        versions,
      },
      samples,
    };
  },
};

// ---------------------------------------------------------------------------
// Разработка ПО (Scrum-лайт)
// ---------------------------------------------------------------------------

const software: BoardTemplate = {
  id: 'software',
  name: 'Разработка ПО',
  description: 'Классический Jira-процесс: истории, задачи, баги, эпики, ревью и релизы.',
  icon: '💻',
  color: '#1D7AFC',
  defaultKey: 'DEV',
  build: () => {
    const t = todayISO();
    return {
      draft: {
        template: 'software',
        icon: '💻',
        color: '#1D7AFC',
        columns: [col('todo', 'К выполнению', 'todo'), col('progress', 'В работе', 'progress', 4), col('review', 'Ревью', 'progress'), col('done', 'Готово', 'done')],
        issueTypes: [
          { id: 'epic', name: 'Эпик', icon: 'epic', color: '#904EE2', isEpic: true },
          { id: 'story', name: 'История', icon: 'story', color: '#22A06B', template: STORY_TEMPLATE },
          { id: 'task', name: 'Задача', icon: 'task', color: '#1D7AFC' },
          { id: 'bug', name: 'Баг', icon: 'bug', color: '#E2483D', template: SW_BUG_TEMPLATE },
        ],
        labels: ['frontend', 'backend', 'devops', 'ux', 'security'],
        components: ['API', 'Web', 'Mobile', 'Инфраструктура'],
        versions: [ver('v1', '1.0', 'unreleased', '', t, addDays(t, 14)), ver('v1-1', '1.1', 'unreleased', '', addDays(t, 14), addDays(t, 28))],
      },
      samples: [
        { title: 'Регистрация и вход', type: 'epic', status: 'progress', version: 'v1' },
        { title: 'Как пользователь, я хочу войти через GitHub', type: 'story', status: 'progress', epic: 'Регистрация и вход', version: 'v1', storyPoints: 3, assignToMe: true },
        { title: 'Кнопка «Выйти» не работает в Safari', type: 'bug', status: 'todo', priority: 'high', version: 'v1', storyPoints: 1 },
        { title: 'Настроить CI для pull request', type: 'task', status: 'done', components: ['Инфраструктура'], version: 'v1' },
      ],
    };
  },
};

// ---------------------------------------------------------------------------
// Пустая
// ---------------------------------------------------------------------------

const blank: BoardTemplate = {
  id: 'blank',
  name: 'Пустая доска',
  description: 'Три колонки и базовые типы задач — настройте всё под себя.',
  icon: '📋',
  color: '#626F86',
  defaultKey: 'KB',
  build: () => ({
    draft: {
      template: 'blank',
      icon: '📋',
      color: '#626F86',
      columns: [col('todo', 'К выполнению', 'todo'), col('progress', 'В работе', 'progress'), col('done', 'Готово', 'done')],
      issueTypes: [
        { id: 'epic', name: 'Эпик', icon: 'epic', color: '#904EE2', isEpic: true },
        { id: 'task', name: 'Задача', icon: 'task', color: '#1D7AFC' },
        { id: 'bug', name: 'Баг', icon: 'bug', color: '#E2483D' },
      ],
      labels: [],
      components: [],
      versions: [],
    },
    samples: [],
  }),
};

export const TEMPLATES: BoardTemplate[] = [gameDev, home, software, blank];

export function newColumnId(): string {
  return 'c-' + uid(6);
}
