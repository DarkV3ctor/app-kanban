// Applies the saved design (Classic / Apple / Fluent / Linux) and light/dark mode before the app renders, so the page
// never flashes in the wrong theme. No saved mode = follow the system setting. See src/appearance.ts.
// Kept as a file rather than an inline script so the Content Security Policy needs no inline scripts.
try {
  var root = document.documentElement;
  var t = localStorage.getItem('kb-theme');
  if (t === 'light' || t === 'dark') root.setAttribute('data-theme', t);
  var d = localStorage.getItem('kb-design');
  root.setAttribute('data-design', d === 'apple' || d === 'fluent' || d === 'linux' ? d : 'classic');
} catch (e) {}
