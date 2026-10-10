import { readAppVersionLabel } from '@/platform/diagnostics/appVersion.ts'

export function AppFooter() {
  return (
    <footer className="app-footer">
      <p>{readAppVersionLabel()}</p>
    </footer>
  )
}
