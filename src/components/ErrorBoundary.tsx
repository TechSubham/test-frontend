import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State {
  failed: boolean
}

/** Last line of defence: a render bug shows a readable message, never a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('UI error', error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div role="alert" className="mx-auto mt-24 max-w-md px-6 text-center">
        <h1 className="text-xl font-semibold text-ink-900">The interface hit an error</h1>
        <p className="mt-2 text-sm text-muted">Reload the page to start a new chat. Earlier chats stay on the server.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-5 rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-white"
        >
          Reload
        </button>
      </div>
    )
  }
}
