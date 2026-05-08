import { Component, StrictMode } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-[#141414] flex flex-col items-center justify-center gap-4 px-4">
          <span className="text-5xl">⚠️</span>
          <h1 className="text-white font-bold text-xl">Algo deu errado</h1>
          <p className="text-[#B3B3B3] text-sm text-center max-w-sm">
            {(this.state.error as Error).message}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 px-6 py-2 bg-[#E50914] text-white rounded-lg text-sm font-semibold hover:bg-[#F40612] transition-colors"
          >
            Recarregar página
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
