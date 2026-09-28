import { buttonClass } from '@/components/buttonStyles'
import { LandmarkList } from '@/components/LandmarkList/LandmarkList'
import { StudyPanelPrompt } from '@/components/StudyMode/StudyMode'
import { contralateralId, getBone } from '@/data/bones'
import { getLandmark } from '@/data/landmarks'
import { CLASS_LABEL, REGION_LABEL } from '@/data/labels'
import { useAnatomyStore } from '@/store/anatomyStore'
import { cn } from '@/utils/cn'

export function AnatomyInfoPanel({ className, id }: { className?: string; id?: string }) {
  const selectedBoneId = useAnatomyStore((state) => state.selectedBoneId)
  const selectedLandmarkId = useAnatomyStore((state) => state.selectedLandmarkId)
  const isolated = useAnatomyStore((state) => state.isolated)
  const studyMode = useAnatomyStore((state) => state.studyMode)
  const studyRevealed = useAnatomyStore((state) => state.studyRevealed)
  const selectBone = useAnatomyStore((state) => state.selectBone)
  const toggleIsolate = useAnatomyStore((state) => state.toggleIsolate)
  const clearIsolation = useAnatomyStore((state) => state.clearIsolation)
  const bone = getBone(selectedBoneId)
  const landmark = getLandmark(selectedLandmarkId)
  const otherSide = selectedBoneId ? contralateralId(selectedBoneId) : null

  return (
    <aside id={id} tabIndex={-1} className={cn('h-full min-h-0 flex-col border-line bg-panel focus:outline-none', className)}>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-5 py-5">
        {studyMode && !studyRevealed ? (
          <StudyPanelPrompt />
        ) : !bone ? (
          <div className="pt-8">
            <h2 className="text-[28px] leading-tight font-medium tracking-tight">Explore the skeleton</h2>
            <p className="mt-3 max-w-xs text-[15px] leading-6 text-muted">
              Select a bone in the 3D model or choose one from the anatomy navigator.
            </p>
          </div>
        ) : (
          <article key={bone.id} className="atlas-in">
            <p className="text-[12px] font-medium tracking-[0.14em] text-faint uppercase">
              {REGION_LABEL[bone.region]}
              {bone.side !== 'midline' ? ` · ${bone.side === 'left' ? 'Left' : 'Right'}` : ''}
            </p>
            <div className="mt-3 flex items-start justify-between gap-3">
              <h2 className="text-[32px] leading-none font-medium tracking-tight">{bone.name}</h2>
            </div>
            {bone.side !== 'midline' ? (
              <p className="mt-2 text-[14px] text-muted">{bone.displayName}</p>
            ) : null}
            {otherSide ? (
              <div className="mt-3 flex gap-1" role="group" aria-label="Side">
                {(['left', 'right'] as const).map((side) => {
                  const id = side === bone.side ? bone.id : otherSide
                  const pressed = bone.side === side
                  return (
                    <button
                      key={side}
                      type="button"
                      aria-pressed={pressed}
                      className={cn(
                        'h-7 rounded-md px-2.5 text-[12px] font-medium',
                        pressed ? 'bg-accent text-accent-ink' : 'border border-line text-muted hover:text-text',
                      )}
                      onClick={() => selectBone(id)}
                    >
                      {side === 'left' ? 'Left' : 'Right'}
                    </button>
                  )
                })}
              </div>
            ) : null}
            <p className="mt-4 text-[15px] leading-6 text-text/90">{bone.description}</p>
            <dl className="mt-5 grid gap-4">
              <div>
                <dt className="text-[12px] font-medium tracking-[0.14em] text-faint uppercase">Classification</dt>
                <dd className="mt-1 text-[14px]">{CLASS_LABEL[bone.classification]}</dd>
              </div>
              <div>
                <dt className="text-[12px] font-medium tracking-[0.14em] text-faint uppercase">Articulations</dt>
                <dd className="mt-1">
                  <ul className="space-y-1">
                    {bone.articulations.map((item) => (
                      <li key={item} className="text-[14px] leading-5 text-text/90">
                        {item}
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            </dl>
            {bone.partOf ? (
              <button
                type="button"
                className="mt-4 text-left text-[13px] text-accent hover:underline"
                onClick={() => selectBone(bone.partOf!)}
              >
                Part of {getBone(bone.partOf)?.name}
              </button>
            ) : null}
            {bone.compositeOf?.length ? (
              <div className="mt-4">
                <p className="text-[12px] font-medium tracking-[0.14em] text-faint uppercase">Included bones</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {bone.compositeOf.map((id) => (
                    <button
                      key={id}
                      type="button"
                      className={buttonClass('ghost', 'h-7')}
                      onClick={() => selectBone(id)}
                    >
                      {getBone(id)?.displayName ?? id}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {landmark && landmark.boneId === bone.id ? (
              <section className="mt-5 rounded-lg border border-accent/40 bg-accent/8 p-3">
                <h3 className="text-[12px] font-medium tracking-[0.14em] text-accent uppercase">
                  {landmark.landmark.name}
                </h3>
                <p className="mt-2 text-[14px] leading-6 text-text/90">{landmark.landmark.description}</p>
                {landmark.landmark.significance ? (
                  <p className="mt-2 text-[13px] leading-5 text-muted">{landmark.landmark.significance}</p>
                ) : null}
              </section>
            ) : null}
            <LandmarkList landmarks={bone.landmarks} boneId={bone.id} />
            <div className="mt-6 flex flex-wrap gap-2">
              {isolated ? (
                <button type="button" className={buttonClass('solid')} onClick={clearIsolation}>
                  Show full skeleton
                </button>
              ) : (
                <button type="button" className={buttonClass('ghost')} onClick={toggleIsolate}>
                  Isolate
                </button>
              )}
            </div>
          </article>
        )}
      </div>
    </aside>
  )
}
