/** Sieben Tod: Zahlen mit einer 7 oder durch 7 teilbar werden nicht gesagt, sondern mit „Piep“ ersetzt. */
export function isPiep(value: number): boolean {
  if (!Number.isInteger(value) || value < 1) {
    return false
  }
  return value % 7 === 0 || String(value).includes('7')
}

/** Das, was der Spieler bei dieser Zahl sagen muss. */
export function sevenDeathCall(value: number): string {
  return isPiep(value) ? 'Piep' : String(value)
}
