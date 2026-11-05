import { syncConfigured } from '@/features/sync/client'
import { create } from 'zustand'

export type AccountStatus = 'disabled' | 'signedOut' | 'connecting' | 'signedIn'
export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error'

export interface AccountUser {
  id: string
  email: string | null
  name: string | null
}

interface AccountState {
  status: AccountStatus
  user: AccountUser | null
  syncStatus: SyncStatus
  lastSyncedAt: string | null
  syncError: string | null
  /** Where the last magic link went, to show "check your inbox". */
  emailSentTo: string | null
  authError: string | null
  dialogOpen: boolean
  setDialogOpen: (open: boolean) => void
}

export const useAccountStore = create<AccountState>((set) => ({
  status: syncConfigured ? 'signedOut' : 'disabled',
  user: null,
  syncStatus: 'idle',
  lastSyncedAt: null,
  syncError: null,
  emailSentTo: null,
  authError: null,
  dialogOpen: false,
  setDialogOpen: (dialogOpen) => set({ dialogOpen }),
}))
