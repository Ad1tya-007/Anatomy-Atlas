import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { useAccountStore } from '@/features/sync/accountStore'
import {
  listTutorThreads,
  loadTutorThread,
  saveTutorThread,
  type TutorThreadSummary,
} from '@/features/sync/tutorThreads'
import { splitCitations } from '@/features/tutor/citations'
import type { TutorUIMessage } from '@/features/tutor/messages'
import type { GeneratedQuestion } from '@/features/tutor/tools'
import { QUESTION_MAX, tutorChat, tutorErrorMessage, useTutorNotes } from '@/features/tutor/tutorChat'
import { openCitation, undoViewerAction } from '@/features/tutor/viewerActions'
import { useAnatomyStore } from '@/store/anatomyStore'
import { cn } from '@/lib/utils'
import { useChat } from '@ai-sdk/react'
import { ArrowUp, History, Move3d, Plus, RotateCcw, Search, Square } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'

const SUGGESTIONS = [
  'What is the greater trochanter?',
  'Show me the bones of the knee',
  'Which bones form the elbow?',
  'Ask me a question about the scapula',
]

const VIEWER_TOOL_PARTS = new Set([
  'tool-select_bone',
  'tool-select_landmark',
  'tool-select_joint',
  'tool-frame_region',
  'tool-set_look',
  'tool-set_section',
  'tool-set_spread',
  'tool-start_walk',
  'tool-start_quiz',
])

type MessagePart = TutorUIMessage['parts'][number]
type ToolPart = Extract<MessagePart, { toolCallId: string; state: string }>

function isToolPart(part: MessagePart): part is ToolPart {
  return part.type.startsWith('tool-') && 'toolCallId' in part
}

function CitedText({ text }: { text: string }) {
  return (
    <p className="text-sm leading-6 whitespace-pre-wrap">
      {splitCitations(text).map((segment, index) =>
        segment.type === 'text' ? (
          <span key={index}>{segment.text}</span>
        ) : (
          <button
            key={index}
            type="button"
            className="mx-0.5 inline-flex translate-y-[-1px] items-center rounded-sm border border-specimen/40 bg-specimen/10 px-1.5 py-px align-middle text-[0.7rem] leading-4 font-medium text-foreground hover:bg-specimen/20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            title={`Open ${segment.doc.title} in the viewer`}
            onClick={() => openCitation(segment.doc)}
          >
            {segment.doc.title.replace(/^Guided walk: /, '')}
          </button>
        ),
      )}
    </p>
  )
}

function ViewerNoteRow({ part }: { part: ToolPart }) {
  const note = useTutorNotes((state) => state.notes[part.toolCallId])
  const markUndone = useTutorNotes((state) => state.markUndone)
  if (part.state === 'input-streaming' || (part.state === 'input-available' && !note)) {
    return (
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Spinner className="size-3" /> Moving the camera…
      </p>
    )
  }
  if (part.state === 'output-error') {
    return <p className="text-xs text-destructive">The tutor tried a viewer action the atlas does not have.</p>
  }
  if (!note) return null
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-md border border-dashed px-2 py-1.5 text-xs',
        note.ok ? 'text-muted-foreground' : 'border-destructive/40 text-destructive',
      )}
    >
      <Move3d className="size-3.5 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1">
        {note.ok ? <span className="sr-only">AI moved the camera: </span> : null}
        {note.undone ? <s>{note.note}</s> : note.note}
      </span>
      {note.ok && !note.undone ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-1.5 text-xs"
          onClick={() => {
            undoViewerAction(note.before)
            markUndone(part.toolCallId)
          }}
        >
          <RotateCcw className="size-3" /> Undo
        </Button>
      ) : null}
    </div>
  )
}

function QuizCard({ question, fallback }: { question: GeneratedQuestion; fallback: boolean }) {
  const [picked, setPicked] = useState<string | null>(null)
  const selectBone = useAnatomyStore((state) => state.selectBone)
  const selectLandmark = useAnatomyStore((state) => state.selectLandmark)
  const correct = picked === question.answerId
  return (
    <Card className="gap-3 border-l-2 border-l-primary bg-white/2 p-3.5">
      <p className="kicker">{fallback ? 'Practice question' : 'Question'}</p>
      <p className="text-sm font-medium">{question.prompt}</p>
      <div role="group" aria-label="Choices" className="grid gap-1.5">
        {question.choices.map((choice) => {
          const isAnswer = choice.id === question.answerId
          return (
            <Button
              key={choice.id}
              type="button"
              variant="outline"
              size="sm"
              disabled={picked !== null}
              aria-pressed={picked === choice.id}
              className={cn(
                'justify-start disabled:opacity-100',
                picked && isAnswer && 'border-emerald-600 bg-emerald-600/10',
                picked === choice.id && !isAnswer && 'border-destructive bg-destructive/10',
              )}
              onClick={() => setPicked(choice.id)}
            >
              {choice.label}
            </Button>
          )
        })}
      </div>
      {picked ? (
        <div className="grid gap-2 text-sm" aria-live="polite">
          <p
            className={correct ? 'font-medium text-emerald-700 dark:text-emerald-400' : 'font-medium text-destructive'}
          >
            {correct
              ? 'Correct.'
              : `Not quite: it is ${question.choices.find((c) => c.id === question.answerId)?.label}.`}
          </p>
          {question.explanation ? <p className="text-muted-foreground">{question.explanation}</p> : null}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="justify-self-start"
            onClick={() =>
              question.kind === 'bone' ? selectBone(question.answerId) : selectLandmark(question.answerId)
            }
          >
            Show in the viewer
          </Button>
        </div>
      ) : null}
    </Card>
  )
}

function AssistantPart({ part }: { part: MessagePart }) {
  if (part.type === 'text') return part.text.trim() ? <CitedText text={part.text} /> : null
  if (!isToolPart(part)) return null
  if (VIEWER_TOOL_PARTS.has(part.type)) return <ViewerNoteRow part={part} />
  if (part.type === 'tool-search_atlas') {
    const query = (part.input as { query?: string } | undefined)?.query
    return query ? (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Search className="size-3" aria-hidden /> Searched the atlas for “{query}”
      </p>
    ) : null
  }
  if (part.type === 'tool-generate_question') {
    if (part.state === 'output-available') {
      const output = part.output as { question: GeneratedQuestion; fallback: boolean }
      return <QuizCard question={output.question} fallback={output.fallback} />
    }
    if (part.state === 'output-error') return <p className="text-xs text-destructive">Could not write a question.</p>
    return (
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Spinner className="size-3" /> Writing a question…
      </p>
    )
  }
  return null
}

function Message({ message }: { message: TutorUIMessage }) {
  if (message.role === 'user') {
    const text = message.parts.map((part) => (part.type === 'text' ? part.text : '')).join('')
    return (
      <div className="ml-10 max-w-[90%] self-end rounded-2xl rounded-br-md bg-primary/14 px-3.5 py-2.5 text-sm leading-6 whitespace-pre-wrap ring-1 ring-primary/25">
        {text}
      </div>
    )
  }
  return (
    <div className="grid gap-2">
      {message.parts.map((part, index) => (
        <AssistantPart key={index} part={part} />
      ))}
    </div>
  )
}

function RecentChats({ onOpen }: { onOpen: (id: string) => void }) {
  const [threads, setThreads] = useState<TutorThreadSummary[] | null>(null)
  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (!open) return
        setThreads(null)
        listTutorThreads()
          .then(setThreads)
          .catch(() => setThreads([]))
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Recent chats">
          <History />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Recent chats</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {threads === null ? (
          <DropdownMenuItem disabled>
            <Spinner /> Loading…
          </DropdownMenuItem>
        ) : threads.length === 0 ? (
          <DropdownMenuItem disabled>No saved chats yet</DropdownMenuItem>
        ) : (
          threads.map((thread) => (
            <DropdownMenuItem key={thread.id} onSelect={() => onOpen(thread.id)}>
              <span className="truncate">{thread.title}</span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

let threadId: string | null = null

/** Keeps the newest message in view while it streams in. */
function useStickToBottom<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  useEffect(() => {
    const node = ref.current
    if (!node) return
    const observer = new MutationObserver(() => node.lastElementChild?.scrollIntoView?.({ block: 'end' }))
    observer.observe(node, { childList: true, subtree: true, characterData: true })
    return () => observer.disconnect()
  }, [])
  return ref
}

export default function TutorPanel({ className }: { className?: string }) {
  const { messages, sendMessage, status, error, stop, regenerate, setMessages, clearError } = useChat({
    chat: tutorChat(),
    throttle: 50,
  })
  const signedIn = useAccountStore((state) => state.status === 'signedIn')
  const [draft, setDraft] = useState('')
  const log = useStickToBottom<HTMLDivElement>()
  const busy = status === 'submitted' || status === 'streaming'

  useEffect(() => {
    if (!signedIn || status !== 'ready' || messages.length < 2 || messages.at(-1)?.role !== 'assistant') return
    const snapshot = messages
    const timer = window.setTimeout(() => {
      saveTutorThread(threadId, snapshot)
        .then((id) => {
          threadId = id
        })
        .catch(() => {})
    }, 1000)
    return () => window.clearTimeout(timer)
  }, [signedIn, status, messages])

  const ask = (text: string) => {
    const question = text.trim().slice(0, QUESTION_MAX)
    if (!question || busy) return
    clearError()
    void sendMessage({ text: question })
    setDraft('')
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    ask(draft)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      ask(draft)
    }
  }

  const newChat = () => {
    void stop()
    threadId = null
    setMessages([])
    useTutorNotes.getState().reset()
    clearError()
  }

  const openThread = (id: string) => {
    loadTutorThread(id)
      .then((loaded) => {
        void stop()
        threadId = id
        useTutorNotes.getState().reset()
        setMessages(loaded)
      })
      .catch(() => {})
  }

  return (
    <section aria-label="Tutor" className={cn('h-full min-h-0 flex-col bg-transparent', className)}>
      <div className="flex items-center gap-2 border-b border-white/6 px-4 py-3">
        <span
          className="mt-0.5 size-1.5 shrink-0 rounded-full bg-primary shadow-[0_0_8px_var(--primary)]"
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <h2 className="font-specimen text-lg leading-none tracking-tight">Atlas tutor</h2>
          <p className="mt-1 text-[0.7rem] leading-4 text-muted-foreground">
            Educational use only, not medical advice. Answers come from this atlas and can be wrong.
          </p>
        </div>
        {signedIn ? <RecentChats onOpen={openThread} /> : null}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="New chat"
          disabled={messages.length === 0}
          onClick={newChat}
        >
          <Plus />
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div ref={log} className="flex flex-col gap-4 px-4 py-4" aria-live="polite" aria-busy={busy}>
          {messages.length === 0 ? (
            <div className="grid gap-4 pt-2">
              <div>
                <p className="kicker">Start here</p>
                <p className="mt-2 font-specimen text-[1.65rem] leading-none tracking-tight text-balance">
                  Ask the atlas anything it can show you.
                </p>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  Ask about any bone, landmark, or joint in the atlas. The tutor cites its sources and can move the
                  viewer to show you.
                </p>
              </div>
              <div className="grid gap-1.5">
                {SUGGESTIONS.map((suggestion, index) => (
                  <Button
                    key={suggestion}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-auto justify-start gap-3 rounded-lg border-white/8 bg-white/2 py-2.5 text-left font-normal whitespace-normal hover:border-primary/40 hover:bg-primary/8"
                    onClick={() => ask(suggestion)}
                  >
                    <span aria-hidden className="font-mono text-[10px] text-primary">
                      0{index + 1}
                    </span>
                    {suggestion}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message) => <Message key={message.id} message={message} />)
          )}
          {status === 'submitted' ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Spinner className="size-3" /> Thinking…
            </p>
          ) : null}
          {error ? (
            <Alert variant="destructive">
              <AlertDescription className="flex items-center justify-between gap-2">
                <span>{tutorErrorMessage(error)}</span>
                <Button type="button" variant="outline" size="sm" onClick={() => void regenerate()}>
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}
        </div>
      </ScrollArea>

      <form onSubmit={submit} className="grid gap-1 border-t border-white/6 p-3">
        <div className="rounded-xl border border-white/10 bg-black/25 p-1.5 focus-within:border-primary/50">
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
            maxLength={QUESTION_MAX}
            rows={2}
            placeholder="Ask about the skeleton…"
            aria-label="Ask the tutor"
            className="max-h-40 min-h-12 resize-none border-0 bg-transparent px-2 py-1.5 text-sm shadow-none focus-visible:ring-0"
          />
          <div className="flex items-center justify-between px-1 pb-0.5">
            <p className="kicker pl-1">Enter to send</p>
            {busy ? (
              <Button type="button" size="icon" variant="secondary" aria-label="Stop" onClick={() => void stop()}>
                <Square />
              </Button>
            ) : (
              <Button type="submit" size="icon" aria-label="Send" disabled={!draft.trim()}>
                <ArrowUp />
              </Button>
            )}
          </div>
        </div>
        {draft.length > QUESTION_MAX * 0.8 ? (
          <p className="text-right text-[0.7rem] text-muted-foreground">
            {draft.length} / {QUESTION_MAX}
          </p>
        ) : null}
      </form>
    </section>
  )
}
