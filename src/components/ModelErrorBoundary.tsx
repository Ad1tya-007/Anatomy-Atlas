import { useAnatomyStore } from '@/store/anatomyStore'
import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  resetKey: number
}

interface State {
  failed: boolean
  resetKey: number
}

export class ModelErrorBoundary extends Component<Props, State> {
  state: State = { failed: false, resetKey: this.props.resetKey }

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true }
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    if (props.resetKey === state.resetKey) return null
    return { failed: false, resetKey: props.resetKey }
  }

  componentDidCatch(): void {
    useAnatomyStore.getState().setModelState('error')
  }

  render(): ReactNode {
    if (this.state.failed) return null
    return this.props.children
  }
}
