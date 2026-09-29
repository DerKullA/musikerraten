import { readAppVersion } from '../lib/appVersion.ts'

export function AppFooter() {
  return (
    <footer className="app-footer">
      <p>{readAppVersion()}</p>
    </footer>
  )
}
