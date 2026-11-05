import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useAccountStore } from '@/features/sync/accountStore'
import { CloudOff, UserRound } from 'lucide-react'
import { lazy, Suspense, useState } from 'react'

const AccountDialog = lazy(() => import('@/components/AccountDialog/AccountDialog'))

function initial(name: string | null, email: string | null): string {
  return (name ?? email ?? '?').trim().charAt(0).toUpperCase() || '?'
}

/** Header entry point for sign-in and sync. Absent from builds without a Supabase project. */
export function AccountButton() {
  const status = useAccountStore((state) => state.status)
  const user = useAccountStore((state) => state.user)
  const syncStatus = useAccountStore((state) => state.syncStatus)
  const open = useAccountStore((state) => state.dialogOpen)
  const setOpen = useAccountStore((state) => state.setDialogOpen)
  const [loaded, setLoaded] = useState(false)
  if (status === 'disabled') return null

  const signedIn = status === 'signedIn' && user
  const trouble = syncStatus === 'offline' || syncStatus === 'error'
  const label = signedIn ? `Account and sync${trouble ? ' (not synced)' : ''}` : 'Sign in to sync your progress'

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={label}
            className="relative"
            onClick={() => {
              setLoaded(true)
              setOpen(true)
            }}
          >
            {signedIn ? (
              <span className="font-mono text-[12px] font-medium">{initial(user.name, user.email)}</span>
            ) : (
              <UserRound />
            )}
            {signedIn && trouble ? (
              <CloudOff
                className="absolute -right-1 -bottom-1 size-3 rounded-sm bg-card text-destructive"
                aria-hidden
              />
            ) : null}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{signedIn ? 'Account and sync' : 'Sign in to sync'}</TooltipContent>
      </Tooltip>
      {loaded || open ? (
        <Suspense fallback={null}>
          <AccountDialog />
        </Suspense>
      ) : null}
      {status === 'connecting' ? <span className="sr-only">Connecting to your account</span> : null}
    </>
  )
}
