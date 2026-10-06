export function formatAppVersion(version: string): string {
  return version.startsWith('v') ? version : `v${version}`
}

export function readAppVersion(): string {
  return formatAppVersion(__APP_VERSION__)
}

/** Version für die Anzeige: Kurz-Hash mit Trennpunkt statt `+`. */
export function readAppVersionLabel(): string {
  return readAppVersion().replace('+', ' · ')
}
