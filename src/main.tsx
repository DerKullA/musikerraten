import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from '@/app/App.tsx'
import { installClientLogger } from '@/platform/diagnostics/clientLog.ts'
import { installGameDebug } from '@/platform/diagnostics/gameDebug.ts'
import '@/styles/base.css'
import '@/games/guess-song/guess-song.css'
import '@/games/shotless/shotless.css'

installClientLogger()
installGameDebug()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
