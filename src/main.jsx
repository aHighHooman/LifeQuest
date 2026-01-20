import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

try {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
} catch (error) {
  document.getElementById('root').innerHTML = `<div style="color: white; padding: 20px;"><h1>App Crash</h1><pre>${error.message}</pre></div>`;
}
