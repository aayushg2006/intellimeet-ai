import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ErrorBoundary } from './ErrorBoundary.jsx'
import axios from 'axios'
import { installAuthInterceptors } from './lib/api.js'

axios.defaults.baseURL = import.meta.env.VITE_API_URL || '';

// Access tokens are short-lived, so the bare `axios` singleton used by existing
// pages needs the same auth + silent-refresh behaviour as the `api` instance.
installAuthInterceptors(axios);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      {/* <Toaster/> now lives inside App's Router so notification toasts can
          navigate when clicked. */}
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
