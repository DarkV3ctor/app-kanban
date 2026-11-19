// Applies the saved light/dark theme before the app renders (avoids a flash of the wrong theme).
// Kept as a file rather than an inline script so the Content Security Policy needs no inline scripts.
try {
  var t = localStorage.getItem('kb-theme');
  if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
} catch (e) {}
