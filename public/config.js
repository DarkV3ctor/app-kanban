/*
 * Настройки приложения. Этот файл читается в браузере при загрузке страницы.
 *
 * firebase: null  → ДЕМО-РЕЖИМ: данные хранятся только в этом браузере (localStorage),
 *                    вход через GitHub и совместная работа недоступны.
 * firebase: {...} → вставьте сюда конфиг веб-приложения из консоли Firebase
 *                    (Project settings → General → Your apps → SDK setup → Config).
 *                    Эти ключи НЕ секретные — доступ защищают правила firestore.rules.
 *
 * appAdmins: числовые GitHub ID администраторов приложения. Только они (и те, кому они
 *            выдадут право) могут создавать новые доски. Должен совпадать со списком
 *            в функции isAppAdmin() в firestore.rules.
 */
window.KANBAN_CONFIG = {
  firebase: null,
  // firebase: {
  //   apiKey: "...",
  //   authDomain: "your-project.firebaseapp.com",
  //   projectId: "your-project",
  //   storageBucket: "your-project.appspot.com",
  //   messagingSenderId: "...",
  //   appId: "..."
  // },
  appAdmins: ["78609208"]
};
