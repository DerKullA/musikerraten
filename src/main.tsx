import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/styles/base.css'
import App from '@/app/App.tsx'
import { installClientLogger } from '@/platform/diagnostics/clientLog.ts'
import { installGameDebug } from '@/platform/diagnostics/gameDebug.ts'

installClientLogger()
installGameDebug()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
