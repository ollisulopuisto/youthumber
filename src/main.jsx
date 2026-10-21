import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

// Analytics is not needed to paint the editor; load it after first render.
const Analytics = lazy(() => import('@vercel/analytics/react').then((m) => ({ default: m.Analytics })))

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
    <Suspense fallback={null}>
      <Analytics />
    </Suspense>
  </StrictMode>,
)
