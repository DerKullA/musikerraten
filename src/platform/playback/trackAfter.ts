// URI des Titels, der in der Spielreihenfolge auf `uri` folgt (am Ende wieder der erste).
export function trackAfter(queued: readonly { uri: string }[], uri: string): string | null {
  const current = queued.findIndex((track) => track.uri === uri)
  if (current < 0 || queued.length < 2) {
    return null
  }
  const next = queued[(current + 1) % queued.length]
  if (!next || next.uri === uri) {
    return null
  }
  return next.uri
}
