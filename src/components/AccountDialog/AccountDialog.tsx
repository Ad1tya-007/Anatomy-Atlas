import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { formatAgo } from '@/features/srs/time'
import { useNow } from '@/features/srs/useMastery'
import { requestSync, sendMagicLink, signInWithProvider, signOut, startAccount } from '@/features/sync/account'
import { useAccountStore, type SyncStatus } from '@/features/sync/accountStore'
import {
  deleteSavedView,
  listSavedViews,
  SAVED_VIEW_NAME_MAX,
  saveView,
  type SavedView,
} from '@/features/sync/savedViews'
import { useAnatomyStore } from '@/store/anatomyStore'
import { viewFromState, hasView } from '@/utils/urlState'
import { CloudCheck, CloudOff, Mail, RefreshCw, Trash2, TriangleAlert } from 'lucide-react'
import { useEffect, useId, useState, type FormEvent } from 'react'
import { toast } from 'sonner'

function syncLabel(status: SyncStatus, lastSyncedAt: string | null): string {
  if (status === 'syncing') return 'Syncing…'
  if (status === 'offline') return 'Offline. Your reviews will sync when you reconnect.'
  if (status === 'error') return 'Sync failed. Your reviews are safe on this device.'
  if (lastSyncedAt) return `Synced ${formatAgo(new Date(lastSyncedAt), new Date())}`
  return 'Not synced yet'
}

function SignIn() {
  const status = useAccountStore((state) => state.status)
  const emailSentTo = useAccountStore((state) => state.emailSentTo)
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const emailId = useId()

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSending(true)
    try {
      await sendMagicLink(email.trim())
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="grid gap-4">
      {emailSentTo ? (
        <Alert>
          <Mail />
          <AlertDescription>
            Check <strong className="text-foreground">{emailSentTo}</strong> for a sign-in link. Open it in this
            browser.
          </AlertDescription>
        </Alert>
      ) : null}
      <form className="grid gap-2" onSubmit={submit}>
        <Label htmlFor={emailId}>Email</Label>
        <div className="flex gap-2">
          <Input
            id={emailId}
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <Button type="submit" disabled={sending || status === 'connecting'}>
            {sending ? <Spinner /> : null}
            Email me a link
          </Button>
        </div>
      </form>
      <div className="flex items-center gap-3 text-[11px] text-muted-foreground uppercase">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" onClick={() => void signInWithProvider('github')}>
          Continue with GitHub
        </Button>
        <Button type="button" variant="outline" onClick={() => void signInWithProvider('google')}>
          Continue with Google
        </Button>
      </div>
    </div>
  )
}

function SavedViews() {
  const [views, setViews] = useState<SavedView[] | null>(null)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const nameId = useId()
  const restoreView = useAnatomyStore((state) => state.restoreView)
  const setDialogOpen = useAccountStore((state) => state.setDialogOpen)

  useEffect(() => {
    let cancelled = false
    listSavedViews()
      .then((list) => !cancelled && setViews(list))
      .catch(() => !cancelled && setViews([]))
    return () => {
      cancelled = true
    }
  }, [])

  const save = async (event: FormEvent) => {
    event.preventDefault()
    const view = viewFromState(useAnatomyStore.getState())
    if (!hasView(view)) {
      toast.error('Nothing to save yet', { description: 'Select a bone or change the look first.' })
      return
    }
    setSaving(true)
    try {
      const saved = await saveView(name, view)
      setViews((list) => [saved, ...(list ?? [])])
      setName('')
    } catch (error) {
      toast.error('Could not save the view', { description: error instanceof Error ? error.message : undefined })
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    const before = views
    setViews((list) => list?.filter((view) => view.id !== id) ?? null)
    try {
      await deleteSavedView(id)
    } catch {
      setViews(before)
      toast.error('Could not delete the view')
    }
  }

  return (
    <section className="grid gap-2" aria-labelledby={`${nameId}-heading`}>
      <h3 id={`${nameId}-heading`} className="kicker">
        Saved views
      </h3>
      <form className="flex gap-2" onSubmit={save}>
        <Label htmlFor={nameId} className="sr-only">
          Name for the current view
        </Label>
        <Input
          id={nameId}
          required
          maxLength={SAVED_VIEW_NAME_MAX}
          placeholder="Name the current view"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <Button type="submit" variant="outline" disabled={saving || name.trim() === ''}>
          Save
        </Button>
      </form>
      {views === null ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : views.length === 0 ? (
        <p className="text-muted-foreground">Views you save show up here on every device.</p>
      ) : (
        <ul className="grid max-h-48 gap-1 overflow-y-auto">
          {views.map((view) => (
            <li key={view.id} className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                className="min-w-0 flex-1 justify-start truncate"
                onClick={() => {
                  restoreView(view.view)
                  setDialogOpen(false)
                }}
              >
                {view.name}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Delete ${view.name}`}
                onClick={() => void remove(view.id)}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function SignedIn() {
  const user = useAccountStore((state) => state.user)
  const syncStatus = useAccountStore((state) => state.syncStatus)
  const lastSyncedAt = useAccountStore((state) => state.lastSyncedAt)
  const setDialogOpen = useAccountStore((state) => state.setDialogOpen)
  useNow(30_000)
  const [signingOut, setSigningOut] = useState(false)
  const Icon = syncStatus === 'offline' ? CloudOff : syncStatus === 'error' ? TriangleAlert : CloudCheck

  const leave = async () => {
    setSigningOut(true)
    try {
      await signOut()
      setDialogOpen(false)
      toast.success('Signed out', { description: 'Your progress is saved to your account.' })
    } catch (error) {
      toast.error('Still signed in', { description: error instanceof Error ? error.message : undefined })
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <div className="grid gap-5">
      <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
        {syncStatus === 'syncing' ? <Spinner /> : <Icon className="size-4 shrink-0" aria-hidden />}
        <p className="flex-1" role="status">
          {syncLabel(syncStatus, lastSyncedAt)}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={syncStatus === 'syncing'}
          onClick={() => void requestSync()}
        >
          <RefreshCw />
          Sync now
        </Button>
      </div>
      <SavedViews />
      <div className="flex items-center justify-between gap-2 border-t pt-4">
        <p className="min-w-0 truncate text-muted-foreground">{user?.email ?? user?.name}</p>
        <Button type="button" variant="outline" disabled={signingOut} onClick={() => void leave()}>
          Sign out
        </Button>
      </div>
    </div>
  )
}

export default function AccountDialog() {
  const open = useAccountStore((state) => state.dialogOpen)
  const setOpen = useAccountStore((state) => state.setDialogOpen)
  const status = useAccountStore((state) => state.status)
  const authError = useAccountStore((state) => state.authError)

  useEffect(() => {
    if (open) void startAccount()
  }, [open])

  const signedIn = status === 'signedIn'
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto text-[13px] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">{signedIn ? 'Your account' : 'Sync your progress'}</DialogTitle>
          <DialogDescription>
            {signedIn
              ? 'Reviews sync in the background and work offline. Each device keeps a full copy.'
              : 'You are studying as a guest, so progress lives only in this browser. Sign in to back it up and continue on any device. What you have studied so far comes with you.'}
          </DialogDescription>
        </DialogHeader>
        {authError ? (
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertDescription>{authError}</AlertDescription>
          </Alert>
        ) : null}
        {signedIn ? <SignedIn /> : <SignIn />}
      </DialogContent>
    </Dialog>
  )
}
