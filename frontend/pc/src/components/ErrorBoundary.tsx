import { Component, ErrorInfo, ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { hasError: boolean; error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, fontFamily: 'sans-serif' }}>
          <h2>应用遇到了错误</h2>
          <pre style={{ background: '#fdd', padding: 16, borderRadius: 8, fontSize: 13 }}>
            {this.state.error?.message}
          </pre>
          <button onClick={() => this.setState({ hasError: false, error: null })} style={{ padding: '8px 16px', marginTop: 12 }}>
            重试
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
