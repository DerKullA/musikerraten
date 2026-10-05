import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { installClientLogger } from './lib/clientLog.ts'
import { installGameDebug } from './lib/gameDebug.ts'
import './index.css'

installClientLogger()
installGameDebug()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
