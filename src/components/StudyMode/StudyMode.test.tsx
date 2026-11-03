// @vitest-environment jsdom
import { StudyCard } from '@/components/StudyMode/StudyMode'
import { correctLabel } from '@/features/study/engine'
import { useAnatomyStore } from '@/store/anatomyStore'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

const initial = useAnatomyStore.getState()

function startChoiceQuestion(): string {
  act(() => {
    useAnatomyStore.setState({ modelState: 'ready' })
    useAnatomyStore.getState().setStudyAnswerMode('choice')
  })
  const state = useAnatomyStore.getState()
  return correctLabel(state.studyKind, state.studyBoneId, state.studyLandmarkId)!
}

describe('StudyCard', () => {
  beforeEach(() => {
    useAnatomyStore.setState(initial, true)
  })

  it('renders nothing outside study mode', () => {
    const { container } = render(<StudyCard />)
    expect(container).toBeEmptyDOMElement()
  })

  it('scores a correct multiple-choice answer and offers the next question', () => {
    const correct = startChoiceQuestion()
    render(<StudyCard />)
    const choices = screen.getByRole('group', { name: 'Answer choices' })
    expect(within(choices).getAllByRole('button').length).toBeGreaterThanOrEqual(2)

    fireEvent.click(within(choices).getByRole('button', { name: correct }))

    expect(screen.getByText('1 of 1 correct')).toBeInTheDocument()
    const picked = within(choices).getByRole('button', { pressed: true })
    expect(picked).toHaveTextContent(correct)
    expect(picked).toHaveTextContent('Correct')
    expect(picked).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next bone' })).toBeInTheDocument()
  })

  it('shows the right answer after a wrong pick', () => {
    const correct = startChoiceQuestion()
    render(<StudyCard />)
    const choices = screen.getByRole('group', { name: 'Answer choices' })
    const wrong = within(choices)
      .getAllByRole('button')
      .find((button) => button.textContent !== correct)!

    fireEvent.click(wrong)

    expect(screen.getByText('0 of 1 correct')).toBeInTheDocument()
    expect(screen.getByText(`Correct answer: ${correct}`)).toBeInTheDocument()
  })

  it('accepts a typed answer', () => {
    act(() => {
      useAnatomyStore.setState({ modelState: 'ready' })
      useAnatomyStore.getState().setStudyAnswerMode('type')
    })
    const state = useAnatomyStore.getState()
    const answer = correctLabel(state.studyKind, state.studyBoneId, state.studyLandmarkId)!
    render(<StudyCard />)

    fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: answer.toLowerCase() } })
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))

    expect(screen.getByText('Correct')).toBeInTheDocument()
    expect(screen.getByText('1 of 1 correct')).toBeInTheDocument()
  })
})
