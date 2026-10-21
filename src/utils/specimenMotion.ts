import type { LookName } from '@/types/anatomy'

let spreadCurrent = 0
let arrivalActive = false
let arrivalPlayed = false
let arrivalStart = 0

let activeLook: LookName = 'atlas'
let fromLook: LookName = 'atlas'
let lookBlend = 1
let lookStart = 0

export function spreadNow(): number {
  return spreadCurrent
}

export function beginArrival(reduced: boolean): void {
  if (arrivalPlayed) return
  arrivalPlayed = true
  if (reduced) {
    arrivalActive = false
    spreadCurrent = 0
    return
  }
  arrivalActive = true
  arrivalStart = performance.now()
  spreadCurrent = 0.35
}

export function cancelArrival(next: number): void {
  arrivalActive = false
  arrivalPlayed = true
  spreadCurrent = next
}

export function tickArrival(now: number, storeSpread: number): void {
  if (!arrivalActive) {
    spreadCurrent = storeSpread
    return
  }
  const t = Math.min(1, (now - arrivalStart) / 800)
  const eased = 1 - (1 - t) ** 3
  spreadCurrent = 0.35 * (1 - eased)
  if (t >= 1) {
    arrivalActive = false
    spreadCurrent = storeSpread
  }
}

export function noteLook(look: LookName, reduced: boolean): void {
  if (look === activeLook) return
  fromLook = activeLook
  activeLook = look
  lookBlend = reduced ? 1 : 0
  lookStart = performance.now()
}

export function tickLook(now: number, reduced: boolean): void {
  if (lookBlend >= 1) return
  lookBlend = reduced ? 1 : Math.min(1, (now - lookStart) / 240)
}

export function lookPaint(): { look: LookName; from: LookName; blend: number } {
  return { look: activeLook, from: fromLook, blend: lookBlend }
}
