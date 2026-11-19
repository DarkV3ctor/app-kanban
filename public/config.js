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
 *
 * appCheckSiteKey: optional reCAPTCHA Enterprise site key for Firebase App Check
 *                  (see "Security hardening" in the README). null = App Check is off.
 *                  The build reads this file to add reCAPTCHA to the Content Security Policy,
 *                  so rebuild after changing it.
 */
window.KANBAN_CONFIG = {
  firebase: {
    apiKey: "AIzaSyA8vV1IeiNP8u5JU-5BwysvDaeZSumxLOc",
    authDomain: "home-planer-rd.firebaseapp.com",
    projectId: "home-planer-rd",
    storageBucket: "home-planer-rd.firebasestorage.app",
    messagingSenderId: "315511278198",
    appId: "1:315511278198:web:42c71ee4e9c975daaf6d57"
  },
  appAdmins: ["78609208"],
  appCheckSiteKey: "6LdNkiguAAAAALw0Ps-8-vwrYhtcafx8JVtZZ5Fw"
};
