// Applies the saved design (Classic / Apple) and light/dark mode before the app renders, so the page
// never flashes in the wrong theme. No saved mode = follow the system setting. See src/appearance.ts.
// Kept as a file rather than an inline script so the Content Security Policy needs no inline scripts.
try {
  var root = document.documentElement;
  var t = localStorage.getItem('kb-theme');
  if (t === 'light' || t === 'dark') root.setAttribute('data-theme', t);
  root.setAttribute('data-design', localStorage.getItem('kb-design') === 'apple' ? 'apple' : 'classic');
} catch (e) {}
