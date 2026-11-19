/**
 * The board page (drag and drop, Markdown, all board views) is a separate chunk: the sign-in page
 * and the board list do not need it. It is requested early when the URL already points to a board,
 * and in idle time on the board list, so opening a board rarely waits for it.
 */
export const loadBoardPage = () => import('./components/BoardPage');

/** Starts loading the board chunk when the browser is idle. */
export function prefetchBoardPage() {
  const load = () => void loadBoardPage().catch(() => {});
  if ('requestIdleCallback' in window) requestIdleCallback(load, { timeout: 3000 });
  else setTimeout(load, 1000);
}
