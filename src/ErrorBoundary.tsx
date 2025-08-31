import { Component, ErrorInfo, ReactNode } from 'react'

type Props = { children?: ReactNode; message?: string }
type State = { hasError: boolean; message?: string }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }
  static getDerivedStateFromError(error: unknown) {
    return { hasError: true, message: error instanceof Error ? error.message : String(error) }
  }
  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('App error:', error, info)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{padding:24,fontFamily:'system-ui'}}>
          <h3>Er ging iets mis</h3>
          <pre style={{whiteSpace:'pre-wrap'}}>{this.state.message ?? this.props.message}</pre>
          <a href={import.meta.env.BASE_URL}>← Terug naar home</a>
        </div>
      )
    }
    return this.props.children ?? null
  }
}
