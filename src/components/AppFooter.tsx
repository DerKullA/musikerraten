import { readAppVersionLabel } from '../lib/appVersion.ts'

export function AppFooter() {
  return (
    <footer className="app-footer">
      <p>{readAppVersionLabel()}</p>
    </footer>
  )
}
