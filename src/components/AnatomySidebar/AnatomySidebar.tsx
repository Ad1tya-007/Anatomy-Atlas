import { BoneList } from '@/components/BoneList/BoneList'
import { CLASS_OPTIONS } from '@/data/labels'
import { useAnatomyStore } from '@/store/anatomyStore'
import { cn } from '@/utils/cn'

export function AnatomySidebar({ className }: { className?: string }) {
  const classification = useAnatomyStore((state) => state.classification)
  const setClassification = useAnatomyStore((state) => state.setClassification)

  return (
    <aside className={cn('h-full min-h-0 flex-col border-r border-line bg-panel', className)}>
      <div className="border-b border-line px-4 py-4">
        <h2 className="text-[12px] font-medium tracking-[0.14em] text-faint uppercase">Skeletal system</h2>
        <fieldset className="mt-3">
          <legend className="text-[12px] text-muted">Bone classification</legend>
          <div className="mt-2 flex flex-wrap gap-1">
            {CLASS_OPTIONS.map((option) => {
              const checked = classification === option.value
              return (
                <label key={option.value} className="cursor-pointer">
                  <input
                    type="radio"
                    name="classification"
                    className="sr-only"
                    checked={checked}
                    onChange={() => setClassification(option.value)}
                  />
                  <span
                    className={cn(
                      'inline-flex h-7 items-center rounded-full border px-2.5 text-[12px]',
                      checked ? 'border-accent text-accent' : 'border-line text-muted hover:text-text',
                    )}
                  >
                    {option.label}
                  </span>
                </label>
              )
            })}
          </div>
        </fieldset>
      </div>
      <nav aria-label="Anatomy navigator" className="scroll-thin min-h-0 flex-1 overflow-y-auto">
        <BoneList />
      </nav>
      <p className="border-t border-line px-4 py-3 text-[11px] leading-4 text-faint">
        Model: Open3D project, CC BY-SA. Left and right are the skeleton’s own sides.
      </p>
    </aside>
  )
}
