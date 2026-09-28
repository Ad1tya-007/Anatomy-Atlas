import { useAnatomyStore } from '@/store/anatomyStore'
import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  resetKey: number
}

interface State {
  failed: boolean
}

export class ModelErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(): void {
    useAnatomyStore.getState().setModelState('error')
  }

  componentDidUpdate(previous: Props): void {
    if (previous.resetKey !== this.props.resetKey && this.state.failed) {
      this.setState({ failed: false })
    }
  }

  render(): ReactNode {
    if (this.state.failed) return null
    return this.props.children
  }
}
