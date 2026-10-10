/**
 * Ref-Callback: holt ein frisch erschienenes Ergebnis samt allem, was darunter folgt, in den sichtbaren Bereich.
 * Auf dem Handy scrollt die Spielfläche selbst, dort liegt das Ergebnis sonst unter dem Rand.
 */
export function revealResult(element: HTMLElement | null): void {
  if (!element) {
    return
  }
  const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
  const scroller = element.closest('.fit-scroll')
  if (scroller && scroller.scrollHeight > scroller.clientHeight) {
    scroller.scrollTo({ top: scroller.scrollHeight, behavior })
    return
  }
  element.scrollIntoView({ behavior, block: 'nearest' })
}
