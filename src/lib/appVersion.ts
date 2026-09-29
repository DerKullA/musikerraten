export function formatAppVersion(version: string): string {
  return version.startsWith('v') ? version : `v${version}`
}

export function readAppVersion(): string {
  return formatAppVersion(__APP_VERSION__)
}
