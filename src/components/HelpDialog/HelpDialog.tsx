import { buttonClass } from '@/components/buttonStyles'
import { useAnatomyStore } from '@/store/anatomyStore'
import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'

const SHORTCUTS = [
  ['R', 'Reset camera'],
  ['F', 'Front view'],
  ['B', 'Back view'],
  ['L', 'Toggle landmarks'],
  ['I', 'Toggle isolation'],
  ['Esc', 'Clear selection'],
]

export function HelpDialog() {
  const open = useAnatomyStore((state) => state.helpOpen)
  const setHelpOpen = useAnatomyStore((state) => state.setHelpOpen)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (open) closeRef.current?.focus()
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center" role="presentation">
      <button type="button" className="absolute inset-0 bg-black/55" aria-label="Close controls guide" onClick={() => setHelpOpen(false)} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
        className="relative max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-xl border border-line bg-panel p-5"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="help-title" className="text-[20px] font-medium tracking-tight">
            Controls
          </h2>
          <button ref={closeRef} type="button" className={buttonClass('ghost', 'h-8 w-8 px-0')} aria-label="Close" onClick={() => setHelpOpen(false)}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4 grid gap-5 text-[14px] leading-6 text-text/90">
          <section>
            <h3 className="text-[12px] font-medium tracking-[0.14em] text-faint uppercase">Mouse and trackpad</h3>
            <ul className="mt-2 space-y-1 text-muted">
              <li>Drag to rotate the skeleton.</li>
              <li>Scroll to zoom.</li>
              <li>Right-drag, or middle-drag, to pan.</li>
              <li>Click a bone to select it. Click a marker to read that landmark.</li>
            </ul>
          </section>
          <section>
            <h3 className="text-[12px] font-medium tracking-[0.14em] text-faint uppercase">Touch</h3>
            <ul className="mt-2 space-y-1 text-muted">
              <li>One finger drags to rotate.</li>
              <li>Pinch to zoom and two fingers drag to pan.</li>
              <li>Tap a bone to select it.</li>
            </ul>
          </section>
          <section>
            <h3 className="text-[12px] font-medium tracking-[0.14em] text-faint uppercase">Keyboard</h3>
            <ul className="mt-2">
              {SHORTCUTS.map(([key, label]) => (
                <li key={key} className="flex items-center justify-between gap-4 border-b border-line/70 py-1.5 text-muted last:border-0">
                  <span>{label}</span>
                  <kbd className="rounded border border-line px-1.5 py-0.5 text-[12px] text-text">{key}</kbd>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h3 className="text-[12px] font-medium tracking-[0.14em] text-faint uppercase">Orientation</h3>
            <p className="mt-2 text-muted">
              The corner gizmo uses anatomical directions: S superior, I inferior, A anterior, P posterior, L the skeleton’s left, R the skeleton’s right. In a front view, the skeleton’s left is on your right.
            </p>
          </section>
          <section>
            <h3 className="text-[12px] font-medium tracking-[0.14em] text-faint uppercase">Model credit</h3>
            <p className="mt-2 text-muted">
              Skeleton geometry is the Open3DModel by the Open3D project, George J.R. Maat, LUMC, Eungyeol Lee, LUMC, and contributors, licensed CC BY-SA. It is based on BodyParts3D and Z-Anatomy. The right-sided bones in the source file are mirrored here to show the left side.
            </p>
            <a className="mt-2 inline-block text-accent hover:underline" href="https://anatomytool.org/open3dmodel" target="_blank" rel="noreferrer">
              anatomytool.org/open3dmodel
            </a>
          </section>
        </div>
      </div>
    </div>
  )
}
