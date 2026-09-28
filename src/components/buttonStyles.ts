import { cn } from '@/utils/cn'

export function buttonClass(variant: 'ghost' | 'solid' | 'quiet' = 'ghost', className?: string): string {
  const base =
    'inline-flex items-center justify-center gap-1.5 rounded-md text-[13px] font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 disabled:pointer-events-none disabled:opacity-40'
  if (variant === 'solid') {
    return cn(base, 'h-8 bg-accent px-3 text-accent-ink hover:bg-[#a5c9c4]', className)
  }
  if (variant === 'quiet') {
    return cn(base, 'h-8 px-2 text-muted hover:text-text', className)
  }
  return cn(base, 'h-8 border border-line bg-white/[0.03] px-2.5 text-text hover:bg-white/[0.06]', className)
}
