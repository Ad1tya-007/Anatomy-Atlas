import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Kbd } from '@/components/ui/kbd'
import { Separator } from '@/components/ui/separator'
import { useAnatomyStore } from '@/store/anatomyStore'

const SHORTCUTS = [
  ['R', 'Reset camera'],
  ['F', 'Front view'],
  ['B', 'Back view'],
  ['L', 'Toggle landmarks'],
  ['I', 'Toggle isolation'],
  ['J', 'Focus search'],
  ['[', 'Previous walk stop'],
  [']', 'Next walk stop'],
  ['Esc', 'Exit walk, study, or clear selection'],
]

export function HelpDialog() {
  const open = useAnatomyStore((state) => state.helpOpen)
  const setHelpOpen = useAnatomyStore((state) => state.setHelpOpen)

  return (
    <Dialog open={open} onOpenChange={setHelpOpen}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="text-base">Controls</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 text-sm leading-6">
          <section>
            <h3 className="kicker">Mouse and trackpad</h3>
            <ul className="mt-2 space-y-1 text-muted-foreground">
              <li>Drag to rotate the skeleton.</li>
              <li>Scroll to zoom.</li>
              <li>Right-drag, or middle-drag, to pan.</li>
              <li>Click a bone to select it. Click a marker to read that landmark.</li>
              <li>Choose a joint in the navigator to emphasize every bone that forms it.</li>
              <li>Compare, beside Left and Right, shows both sides of a paired bone.</li>
              <li>Study mode can be limited to a region or a classification, and answered by choosing or typing.</li>
              <li>Walks step through a fixed path. Exit leaves the last structure selected.</li>
            </ul>
          </section>
          <Separator />
          <section>
            <h3 className="kicker">Touch</h3>
            <ul className="mt-2 space-y-1 text-muted-foreground">
              <li>One finger drags to rotate.</li>
              <li>Pinch to zoom and two fingers drag to pan.</li>
              <li>Tap a bone to select it.</li>
            </ul>
          </section>
          <Separator />
          <section>
            <h3 className="kicker">Keyboard</h3>
            <ul className="mt-2">
              {SHORTCUTS.map(([key, label]) => (
                <li key={key} className="flex items-center justify-between gap-4 border-b py-1.5 text-muted-foreground last:border-0">
                  <span>{label}</span>
                  <Kbd>{key}</Kbd>
                </li>
              ))}
            </ul>
          </section>
          <Separator />
          <section>
            <h3 className="kicker">Orientation</h3>
            <p className="mt-2 text-muted-foreground">
              The corner gizmo uses anatomical directions: S superior, I inferior, A anterior, P posterior, L the skeleton’s left, R the skeleton’s right. In a front view, the skeleton’s left is on your right.
            </p>
          </section>
          <Separator />
          <section>
            <h3 className="kicker">Model credit</h3>
            <p className="mt-2 text-muted-foreground">
              Skeleton geometry is the Open3DModel by the Open3D project, George J.R. Maat, LUMC, Eungyeol Lee, LUMC, and contributors, licensed CC BY-SA. It is based on BodyParts3D and Z-Anatomy. The right-sided bones in the source file are mirrored here to show the left side.
            </p>
            <a className="mt-2 inline-block text-primary underline-offset-4 hover:underline" href="https://anatomytool.org/open3dmodel" target="_blank" rel="noreferrer">
              anatomytool.org/open3dmodel
            </a>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
