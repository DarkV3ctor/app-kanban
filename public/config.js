/*
 * App settings. This file is loaded by the browser before the app starts.
 *
 * firebase: null  → DEMO MODE: data is stored only in this browser (localStorage);
 *                    GitHub sign-in and collaboration are disabled.
 * firebase: {...} → paste your web app config from the Firebase console
 *                    (Project settings → General → Your apps → SDK setup and configuration → Config).
 *                    These values are NOT secret — access is protected by firestore.rules.
 *
 * appAdmins: numeric GitHub IDs of the app administrators. Only they (and the users they allow)
 *            can create new boards. Must match the list in isAppAdmin() in firestore.rules.
 */
window.KANBAN_CONFIG = {
  firebase: null,
  // firebase: {
  //   apiKey: "...",
  //   authDomain: "your-project.firebaseapp.com",
  //   projectId: "your-project",
  //   storageBucket: "your-project.firebasestorage.app",
  //   messagingSenderId: "...",
  //   appId: "..."
  // },
  appAdmins: ["78609208"]
};
