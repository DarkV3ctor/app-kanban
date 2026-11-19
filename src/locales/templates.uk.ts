import type { TemplateTexts } from '../templates';

// Ukrainian text for board templates.

const BUG = `### Кроки відтворення
1.
2.
3.

### Очікуваний результат


### Фактичний результат


### Оточення
- **Білд / версія:**
- **Платформа:** PC / Console / Mobile
- **Частота:** завжди / іноді / один раз

### Логи, скріншоти, відео
`;

const FEATURE = `### Навіщо
Яку проблему гравця вирішує / який досвід створює.

### Що потрібно зробити
-

### Критерії готовності
- [ ] Працює в білді
- [ ] Перевірено плейтестом
- [ ] Немає нових помилок у логах

### Посилання
- Дизайн-документ:
`;

const ART = `### Асет
- **Тип:** персонаж / оточення / UI / VFX / іконка
- **Стиль / референси:**
- **Роздільність / полігонаж:**
- **Формат експорту:**

### Де використовується
`;

const AUDIO = `### Звук
- **Тип:** SFX / музика / озвучення / ембієнт
- **Настрій / референси:**
- **Тривалість / луп:**
- **Коли спрацьовує:**
`;

const LEVEL = `### Рівень
- **Мета гравця:**
- **Нові механіки:**
- **Орієнтовна тривалість:**
- **Ключові моменти / події:**

### Схема
(посилання на блок-аут або скетч)
`;

const DESIGN = `### Механіка / система
Короткий опис.

### Правила
-

### Баланс і параметри
| Параметр | Значення |
|---|---|
|  |  |

### Відкриті питання
-
`;

const TECH_DEBT = `### Проблема
Що зараз погано і чим це заважає.

### Запропоноване рішення


### Ризики
`;

export const UK_TEMPLATES: TemplateTexts = {
  gamedev: {
    name: 'Розробка гри',
    description: 'Фічі, баги, арт, звук, левел-дизайн, плейтести та віхи від прототипу до релізу.',
    columns: { backlog: 'Беклог', todo: 'До роботи', progress: 'В роботі', review: 'Рев’ю', qa: 'Тест / Плейтест', done: 'Готово' },
    types: {
      epic: { name: 'Епік', template: '### Мета\n\n### Склад\n- \n\n### Готово, коли\n- ' },
      feature: { name: 'Фіча', template: FEATURE, checklist: ['Дизайн погоджено', 'Реалізація', 'Код-рев’ю', 'Плейтест'] },
      bug: { name: 'Баг', template: BUG, checklist: ['Відтворено', 'Знайдено причину', 'Виправлено', 'Перевірено в білді'] },
      task: { name: 'Задача' },
      art: { name: 'Арт', template: ART, checklist: ['Скетч', 'Концепт затверджено', 'Фінальний асет', 'Імпорт у рушій'] },
      audio: { name: 'Звук', template: AUDIO, checklist: ['Чернетка', 'Фінальний мікс', 'Інтеграція в рушій'] },
      level: { name: 'Левел-дизайн', template: LEVEL, checklist: ['Блок-аут', 'Геймплейний прохід', 'Арт-пас', 'Світло', 'Оптимізація'] },
      design: { name: 'Геймдизайн', template: DESIGN },
      techdebt: { name: 'Техборг', template: TECH_DEBT },
    },
    labels: ['prototype', 'polish', 'crash', 'performance', 'balance', 'localization', 'blocker', 'playtest'],
    components: ['Геймплей', 'Графіка', 'Анімація', 'Звук', 'UI/UX', 'AI', 'Мережа', 'Фізика', 'Наратив', 'Інструменти', 'Білд/CI'],
    versions: {
      proto: { name: 'Прототип', description: 'Перевірка основної механіки' },
      slice: { name: 'Vertical Slice', description: 'Один рівень у фінальній якості' },
      alpha: { name: 'Alpha', description: 'Усі фічі реалізовано' },
      beta: { name: 'Beta', description: 'Контент готовий, поліровка та баги' },
      release: { name: 'Реліз 1.0', description: 'Вихід у магазині' },
    },
    samples: [
      {
        title: 'Основний ігровий цикл',
        type: 'epic',
        status: 'progress',
        priority: 'high',
        version: 'v-slice',
        description: '### Мета\nГравець досліджує рівень, збирає ресурси та покращує персонажа.\n\n### Склад\n- Керування персонажем\n- Збір ресурсів\n- Магазин покращень',
      },
      {
        title: 'Контролер персонажа: біг, стрибок, ривок',
        type: 'feature',
        status: 'progress',
        priority: 'high',
        version: 'v-slice',
        epic: 'Основний ігровий цикл',
        components: ['Геймплей'],
        storyPoints: 5,
        estimate: '3d',
        assignToMe: true,
        checklist: [
          ['Дизайн погоджено', true],
          ['Реалізація', true],
          ['Код-рев’ю', false],
          ['Плейтест', false],
        ],
      },
      {
        title: 'Персонаж провалюється крізь підлогу на рівні 2',
        type: 'bug',
        status: 'todo',
        priority: 'highest',
        version: 'v-slice',
        components: ['Фізика'],
        labels: ['crash', 'blocker'],
        description: BUG.replace('1. \n2. \n3. ', '1. Завантажити рівень 2\n2. Підійти до мосту\n3. Зробити ривок униз'),
        storyPoints: 2,
      },
      {
        title: 'Концепт-арт головного героя',
        type: 'art',
        status: 'review',
        priority: 'medium',
        version: 'v-slice',
        components: ['Графіка'],
        storyPoints: 3,
        checklist: [
          ['Скетч', true],
          ['Концепт затверджено', false],
          ['Фінальний асет', false],
          ['Імпорт у рушій', false],
        ],
      },
      { title: 'Звуки кроків по різних поверхнях', type: 'audio', status: 'backlog', priority: 'low', version: 'v-alpha', components: ['Звук'], labels: ['polish'] },
      { title: 'Блок-аут навчального рівня', type: 'level', status: 'qa', priority: 'high', version: 'v-slice', epic: 'Основний ігровий цикл', components: ['Геймплей'], labels: ['playtest'], storyPoints: 5, dueInDays: 5 },
      { title: 'Система збережень: формат і міграції', type: 'techdebt', status: 'backlog', priority: 'medium', version: 'v-alpha', components: ['Інструменти'] },
      { title: 'Баланс економіки магазину покращень', type: 'design', status: 'todo', priority: 'medium', version: 'v-alpha', epic: 'Основний ігровий цикл', labels: ['balance'] },
      { title: 'Головне меню та екран паузи', type: 'feature', status: 'done', priority: 'medium', version: 'v-proto', components: ['UI/UX'], storyPoints: 3 },
    ],
  },

  home: {
    name: 'Дім і життя',
    description: 'Хатні справи, покупки, ремонт, фінанси, здоров’я та події — для себе або всієї родини.',
    columns: { ideas: 'Ідеї', planned: 'Заплановано', week: 'Цього тижня', doing: 'У процесі', waiting: 'Чекаємо', done: 'Зроблено' },
    types: {
      goal: { name: 'Ціль', template: '### Чого хочу досягти\n\n### Кроки\n- \n\n### До якого терміну\n' },
      chore: { name: 'Справа' },
      shopping: { name: 'Покупка', template: '- **Де купити:** \n- **Бюджет:** \n' },
      repair: { name: 'Ремонт', template: '### Що зламалося / що зробити\n\n\n### Що знадобиться\n- \n\n### Майстер / контакти\n- \n\n### Бюджет\n- \n' },
      finance: { name: 'Фінанси', template: '- **Сума:** \n- **Термін оплати:** \n- **Як оплатити:** \n- **Квитанція / чек:** \n' },
      health: { name: 'Здоров’я', template: '- **Лікар / клініка:** \n- **Дата і час:** \n- **Що взяти з собою:** \n- **Результати / призначення:** \n' },
      event: { name: 'Подія', template: '- **Коли:** \n- **Де:** \n- **Хто бере участь:** \n- **Що підготувати:** \n' },
      learn: { name: 'Навчання / хобі' },
    },
    labels: ['терміново', 'регулярно', 'разом', 'вихідні', 'бюджет'],
    components: ['Кухня', 'Ванна', 'Вітальня', 'Спальня', 'Дача / сад', 'Авто', 'Діти', 'Тварини', 'Документи'],
    versions: {},
    monthDescription: 'Справи на місяць',
    samples: [
      { title: 'Підготуватися до свят', type: 'goal', status: 'planned', priority: 'medium', version: '$m1' },
      {
        title: 'Продукти на тиждень',
        type: 'shopping',
        status: 'week',
        priority: 'high',
        components: ['Кухня'],
        labels: ['регулярно'],
        dueInDays: 1,
        assignToMe: true,
        checklist: [
          ['Молоко', false],
          ['Хліб', true],
          ['Овочі', false],
          ['Курка', false],
          ['Кава', false],
        ],
      },
      {
        title: 'Полагодити кран на кухні',
        type: 'repair',
        status: 'doing',
        priority: 'high',
        components: ['Кухня'],
        version: '$m0',
        estimate: '2h',
        checklist: [
          ['Купити картридж', true],
          ['Перекрити воду', false],
          ['Замінити картридж', false],
        ],
      },
      { title: 'Сплатити комунальні послуги', type: 'finance', status: 'week', priority: 'highest', labels: ['регулярно', 'терміново'], version: '$m0', dueInDays: 3 },
      { title: 'Записатися до стоматолога', type: 'health', status: 'planned', priority: 'medium', version: '$m0' },
      { title: 'Подарунки рідним', type: 'shopping', status: 'ideas', priority: 'medium', epic: 'Підготуватися до свят', version: '$m1', labels: ['разом'] },
      {
        title: 'Генеральне прибирання',
        type: 'chore',
        status: 'planned',
        priority: 'low',
        epic: 'Підготуватися до свят',
        version: '$m1',
        labels: ['вихідні', 'разом'],
        checklist: [
          ['Вікна', false],
          ['Шафи', false],
          ['Балкон', false],
        ],
      },
      { title: 'Чекаємо доставку пилососа', type: 'shopping', status: 'waiting', priority: 'low', components: ['Вітальня'] },
      { title: 'Поміняти шини на зимові', type: 'chore', status: 'done', priority: 'high', components: ['Авто'], version: '$m0' },
      { title: 'Пройти онлайн-курс з фотографії', type: 'learn', status: 'ideas', priority: 'lowest' },
    ],
  },

  software: {
    name: 'Розробка ПЗ',
    description: 'Класичний процес Jira: історії, задачі, баги, епіки, код-рев’ю та релізи.',
    columns: { todo: 'До виконання', progress: 'В роботі', review: 'Рев’ю', done: 'Готово' },
    types: {
      epic: { name: 'Епік' },
      story: { name: 'Історія', template: '**Як** <роль>, **я хочу** <дія>, **щоб** <цінність>.\n\n### Критерії приймання\n- [ ] \n' },
      task: { name: 'Задача' },
      bug: { name: 'Баг', template: '### Кроки відтворення\n1. \n\n### Очікуваний результат\n\n\n### Фактичний результат\n\n\n### Оточення\n- Версія: \n- ОС / браузер: \n' },
    },
    labels: ['frontend', 'backend', 'devops', 'ux', 'security'],
    components: ['API', 'Web', 'Mobile', 'Інфраструктура'],
    versions: {
      v1: { name: '1.0', description: '' },
      v1_1: { name: '1.1', description: '' },
    },
    samples: [
      { title: 'Реєстрація та вхід', type: 'epic', status: 'progress', version: 'v1' },
      { title: 'Як користувач, я хочу увійти через GitHub', type: 'story', status: 'progress', epic: 'Реєстрація та вхід', version: 'v1', storyPoints: 3, assignToMe: true },
      { title: 'Кнопка «Вийти» не працює в Safari', type: 'bug', status: 'todo', priority: 'high', version: 'v1', storyPoints: 1 },
      { title: 'Налаштувати CI для pull request', type: 'task', status: 'done', components: ['Інфраструктура'], version: 'v1' },
    ],
  },

  blank: {
    name: 'Порожня дошка',
    description: 'Три колонки та базові типи задач — налаштуйте все під себе.',
    columns: { todo: 'До виконання', progress: 'В роботі', done: 'Готово' },
    types: { epic: { name: 'Епік' }, task: { name: 'Задача' }, bug: { name: 'Баг' } },
    labels: [],
    components: [],
    versions: {},
    samples: [],
  },
};
