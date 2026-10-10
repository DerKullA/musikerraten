function vibrationAllowed(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
    return false
  }
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Kurzes Feedback, wenn die Auflösung erscheint. Ohne Vibration-API (iOS) passiert nichts. */
export function pulseReveal(): void {
  if (vibrationAllowed()) {
    navigator.vibrate(24)
  }
}
