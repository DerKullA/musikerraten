import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from '@/app/App.tsx'
import { installClientLogger } from '@/platform/diagnostics/clientLog.ts'
import { installGameDebug } from '@/platform/diagnostics/gameDebug.ts'
import './index.css'

installClientLogger()
installGameDebug()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
