import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { getBone } from '@/data/bones'
import { CLASS_LABEL } from '@/data/labels'
import { getLandmark } from '@/data/landmarks'
import { navRegions } from '@/data/regions'
import { useAnatomyStore } from '@/store/anatomyStore'
import type { AnatomicalRegion, BoneClassification, StudyAnswerMode, StudyKind, StudyScope } from '@/types/anatomy'
import { cn } from '@/lib/utils'
import { useEffect, useId, useState } from 'react'

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: Array<{ id: T; label: string }>
  onChange: (id: T) => void
}) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      spacing={0}
      value={value}
      aria-label={label}
      className="w-full"
      onValueChange={(next) => {
        if (next) onChange(next as T)
      }}
    >
      {options.map((option) => (
        <ToggleGroupItem key={option.id} value={option.id} className="flex-1 px-1.5">
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function StudyCard() {
  const studyMode = useAnatomyStore((state) => state.studyMode)
  const studyKind = useAnatomyStore((state) => state.studyKind)
  const revealed = useAnatomyStore((state) => state.studyRevealed)
  const boneId = useAnatomyStore((state) => state.studyBoneId)
  const landmarkId = useAnatomyStore((state) => state.studyLandmarkId)
  const scope = useAnatomyStore((state) => state.studyScope)
  const regionId = useAnatomyStore((state) => state.studyRegionId)
  const classification = useAnatomyStore((state) => state.studyClassification)
  const answerMode = useAnatomyStore((state) => state.studyAnswerMode)
  const choices = useAnatomyStore((state) => state.studyChoices)
  const attempts = useAnatomyStore((state) => state.studyAttempts)
  const correctCount = useAnatomyStore((state) => state.studyCorrect)
  const fallback = useAnatomyStore((state) => state.studyScopeFallback)
  const picked = useAnatomyStore((state) => state.studyPicked)
  const result = useAnatomyStore((state) => state.studyResult)
  const revealStudy = useAnatomyStore((state) => state.revealStudy)
  const nextStudy = useAnatomyStore((state) => state.nextStudy)
  const exitStudy = useAnatomyStore((state) => state.exitStudy)
  const setStudyKind = useAnatomyStore((state) => state.setStudyKind)
  const setStudyScope = useAnatomyStore((state) => state.setStudyScope)
  const setStudyRegion = useAnatomyStore((state) => state.setStudyRegion)
  const setStudyClassification = useAnatomyStore((state) => state.setStudyClassification)
  const setStudyAnswerMode = useAnatomyStore((state) => state.setStudyAnswerMode)
  const submitStudyChoice = useAnatomyStore((state) => state.submitStudyChoice)
  const submitStudyAnswer = useAnatomyStore((state) => state.submitStudyAnswer)
  const modelState = useAnatomyStore((state) => state.modelState)
  const answerId = useId()
  const [draft, setDraft] = useState('')

  useEffect(() => {
    setDraft('')
  }, [answerMode, boneId, landmarkId, studyKind])

  if (!studyMode) return null
  const bone = getBone(boneId)
  const landmark = getLandmark(landmarkId)
  const preparing = !boneId || modelState === 'loading'
  const correctName = studyKind === 'bone' ? bone?.name : landmark?.landmark.name
  const explanation = studyKind === 'bone' ? bone?.description : landmark?.landmark.description
  const choiceReady = answerMode === 'choice' && choices.length >= 2
  const showReveal = answerMode === 'reveal' || (answerMode === 'choice' && !choiceReady)

  return (
    <div className="pointer-events-none absolute inset-x-0 top-4 z-20 flex justify-center px-3">
      <Card
        size="sm"
        className="atlas-in pointer-events-auto max-h-[min(70dvh,40rem)] w-full max-w-md gap-3 overflow-y-auto bg-card/95 py-4 ring-foreground/15 backdrop-blur-sm"
        aria-live="polite"
      >
        <div className="flex items-center justify-between gap-3 px-4">
          <p className="kicker text-primary!">Study mode</p>
          {preparing ? null : (
            <p className="font-mono text-[11px] text-muted-foreground">
              {correctCount} of {attempts} correct
            </p>
          )}
        </div>
        <div className="grid gap-2 px-4">
          <Segmented<StudyScope>
            label="Study scope"
            value={scope}
            options={[
              { id: 'all', label: 'All' },
              { id: 'region', label: 'Region' },
              { id: 'classification', label: 'Class' },
            ]}
            onChange={setStudyScope}
          />
          {scope === 'region' ? (
            <Select value={regionId ?? 'head'} onValueChange={(value) => setStudyRegion(value as AnatomicalRegion)}>
              <SelectTrigger className="w-full" aria-label="Study region">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {navRegions.map((region) => (
                  <SelectItem key={region.id} value={region.id}>
                    {region.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          {scope === 'classification' ? (
            <Select
              value={classification ?? 'long'}
              onValueChange={(value) => setStudyClassification(value as BoneClassification)}
            >
              <SelectTrigger className="w-full" aria-label="Study classification">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(CLASS_LABEL) as BoneClassification[]).map((item) => (
                  <SelectItem key={item} value={item}>
                    {CLASS_LABEL[item]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          {fallback ? (
            <Alert>
              <AlertDescription>Not enough structures in this scope. Using the full skeleton.</AlertDescription>
            </Alert>
          ) : null}
          <Segmented<StudyKind>
            label="Study question type"
            value={studyKind}
            options={[
              { id: 'bone', label: 'Identify bone' },
              { id: 'landmark', label: 'Identify landmark' },
            ]}
            onChange={setStudyKind}
          />
          <Segmented<StudyAnswerMode>
            label="Answer method"
            value={answerMode}
            options={[
              { id: 'reveal', label: 'Reveal' },
              { id: 'choice', label: 'Choose' },
              { id: 'type', label: 'Type' },
            ]}
            onChange={setStudyAnswerMode}
          />
        </div>
        {preparing ? (
          <p className="px-4 text-sm text-muted-foreground">Preparing your study question...</p>
        ) : (
          <div className="px-4">
            <h2 className="text-sm text-muted-foreground">
              {studyKind === 'bone' ? 'What bone is this?' : 'What anatomical landmark is highlighted?'}
            </h2>
            {studyKind === 'landmark' && bone ? <p className="mt-1 font-mono text-[11px] text-muted-foreground">{bone.displayName}</p> : null}
            {showReveal && !revealed ? (
              <div className="mt-4 grid h-16 place-items-center border border-dashed font-mono text-2xl text-muted-foreground">
                ?
              </div>
            ) : null}
            {showReveal && revealed ? (
              <div className="mt-4">
                <p className="text-2xl leading-none font-medium tracking-tight">{correctName}</p>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{explanation}</p>
              </div>
            ) : null}
            {choiceReady ? (
              <div className="mt-4 grid gap-1.5" role="group" aria-label="Answer choices">
                {choices.map((choice) => {
                  const isCorrect = revealed && correctName ? normalize(choice) === normalize(correctName) : false
                  const isPicked = picked ? normalize(choice) === normalize(picked) : false
                  return (
                    <Button
                      key={choice}
                      type="button"
                      variant="outline"
                      disabled={revealed}
                      aria-pressed={isPicked}
                      className={cn(
                        'h-auto justify-between px-3 py-2 text-left text-sm font-normal whitespace-normal disabled:opacity-100',
                        isPicked && 'border-primary bg-primary/10 text-foreground',
                      )}
                      onClick={() => submitStudyChoice(choice)}
                    >
                      <span>{choice}</span>
                      {revealed && isCorrect ? <span className="font-mono text-[10px] tracking-wide">Correct</span> : null}
                      {revealed && isPicked && !isCorrect ? (
                        <span className="font-mono text-[10px] tracking-wide text-muted-foreground">Incorrect</span>
                      ) : null}
                    </Button>
                  )
                })}
              </div>
            ) : null}
            {choiceReady && revealed ? (
              <div className="mt-3">
                {result === 'incorrect' && correctName ? (
                  <p className="text-sm text-foreground">Correct answer: {correctName}</p>
                ) : null}
                <p className={cn('text-sm leading-6 text-muted-foreground', result === 'incorrect' && 'mt-2')}>{explanation}</p>
              </div>
            ) : null}
            {answerMode === 'type' && !revealed ? (
              <form
                className="mt-4"
                onSubmit={(event) => {
                  event.preventDefault()
                  submitStudyAnswer(draft)
                }}
              >
                <Label htmlFor={answerId}>Your answer</Label>
                <Input
                  id={answerId}
                  value={draft}
                  autoComplete="off"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  className="mt-1.5 h-9 text-sm"
                  onChange={(event) => setDraft(event.target.value)}
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="submit">Check</Button>
                  <Button type="button" variant="ghost" onClick={exitStudy}>
                    Exit study
                  </Button>
                </div>
              </form>
            ) : null}
            {answerMode === 'type' && revealed ? (
              <div className="mt-4">
                <p className="font-mono text-[11px] tracking-wide">{result === 'correct' ? 'Correct' : 'Incorrect'}</p>
                <p className="mt-2 text-2xl leading-none font-medium tracking-tight">{correctName}</p>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{explanation}</p>
              </div>
            ) : null}
            {answerMode === 'type' && !revealed ? null : (
              <div className="mt-4 flex flex-wrap gap-2">
                {!revealed && showReveal ? (
                  <Button type="button" onClick={revealStudy}>
                    Reveal answer
                  </Button>
                ) : null}
                {revealed ? (
                  <Button type="button" onClick={nextStudy}>
                    {studyKind === 'bone' ? 'Next bone' : 'Next landmark'}
                  </Button>
                ) : null}
                <Button type="button" variant="ghost" onClick={exitStudy}>
                  Exit study
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}

export function StudyPanelPrompt() {
  const studyMode = useAnatomyStore((state) => state.studyMode)
  const revealed = useAnatomyStore((state) => state.studyRevealed)
  const studyKind = useAnatomyStore((state) => state.studyKind)
  const answerMode = useAnatomyStore((state) => state.studyAnswerMode)
  const boneId = useAnatomyStore((state) => state.studyBoneId)
  if (!studyMode || revealed) return null
  const bone = getBone(boneId)
  const bonePrompt =
    answerMode === 'choice'
      ? 'A bone is highlighted on the skeleton. Choose its name on the study card.'
      : answerMode === 'type'
        ? 'A bone is highlighted on the skeleton. Type its name on the study card.'
        : 'A bone is highlighted on the skeleton. Answer in your head, then reveal it.'
  const landmarkPrompt =
    answerMode === 'choice'
      ? `${bone?.displayName ?? 'A bone'} is shown with one landmark marked. Choose that landmark on the study card.`
      : answerMode === 'type'
        ? `${bone?.displayName ?? 'A bone'} is shown with one landmark marked. Type the landmark name on the study card.`
        : `${bone?.displayName ?? 'A bone'} is shown with one landmark marked. Name that landmark, then reveal it.`
  return (
    <div className="atlas-in">
      <p className="kicker text-primary!">Study mode</p>
      <h2 className="mt-4 text-2xl leading-tight font-medium tracking-tight">
        {studyKind === 'bone' ? 'Identify the highlighted bone' : 'Identify the landmark'}
      </h2>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{studyKind === 'bone' ? bonePrompt : landmarkPrompt}</p>
    </div>
  )
}
