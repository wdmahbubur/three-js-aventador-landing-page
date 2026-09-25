/** Disclosure descendants can retain layout boxes while being unavailable to focus. */
export function isVisibleFocusTarget(
  element: HTMLElement | null,
  visibility: (element: HTMLElement) => string = element => getComputedStyle(element).visibility
): element is HTMLElement {
  if (!element || element.closest('[hidden], [inert]') || !element.getClientRects().length) return false;
  const closed = element.closest('details:not([open])');
  if (closed && element !== closed.querySelector('summary')) return false;
  return visibility(element) !== 'hidden';
}
