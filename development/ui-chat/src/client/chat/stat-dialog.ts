// One trigger-anchored stat dialog seat shared by the Turn-stat pills
// (TurnUsagePanel) and the composer-dock session stats pills (StatsPills);
// the matching dialog surface skin lives in stat-dialog.module.css.

import { useEffect, useId, useRef, useState, type MutableRefObject } from 'react'
import { useDismissOnOutsidePointer } from '@deepseek-ai/dsh-client-ui-primitives'

/** Open state, refs, and CSS anchor identity for one stat dialog. */
export interface StatDialogSeat {
  open: boolean
  setOpen: (open: boolean) => void
  rootRef: MutableRefObject<HTMLSpanElement | null>
  panelRef: MutableRefObject<HTMLDivElement | null>
  anchorName: string
}

/**
 * One trigger-anchored dialog seat: open state, CSS anchor placement, outside-close.
 * @param controlled - external open state; when given the seat reads and writes
 * it instead of owning its own, letting sibling dialogs share one exclusive slot.
 * @returns the seat; assign the anchor name to the trigger and the portaled panel.
 */
export function useStatDialog(controlled?: Pick<StatDialogSeat, 'open' | 'setOpen'>): StatDialogSeat {
  const [ownOpen, setOwnOpen] = useState(false)
  const open = controlled?.open ?? ownOpen
  const setOpen = controlled?.setOpen ?? setOwnOpen
  const rootRef = useRef<HTMLSpanElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)

  const anchorName = `--dsh-stat-${useId().replaceAll(':', '')}`

  // Outside pointerdown closes through the shared primitive; the portaled
  // panel counts as inside. Escape close stays local, one listener while open.
  useDismissOnOutsidePointer(rootRef, open, setOpen, panelRef)
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => { document.removeEventListener('keydown', onKeyDown) }
  }, [open, setOpen])

  return { open, setOpen, rootRef, panelRef, anchorName }
}
