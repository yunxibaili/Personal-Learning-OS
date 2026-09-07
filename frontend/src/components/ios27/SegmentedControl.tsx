/* Ported from ios27-design-system (MIT) — Copyright (c) 2026 Dcode Labs (Seunghan Kim).
 * Adapted for OLOS 3C-2: Apple UISegmentedControl pill-slide spec. */
import {
  forwardRef,
  useLayoutEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type KeyboardEvent,
} from 'react'
import { cn, useControllableState } from './lib'

export interface SegmentedControlProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange' | 'defaultValue'> {
  segments: string[]
  selected?: number
  defaultSelected?: number
  onChange?: (index: number) => void
}

/**
 * iOS 27 Segmented Control — pill-slide variant.
 *
 * Active indicator is a persistent sliding entity (not per-item bg swap).
 * `transform: translateX()` + `width` transition → CSS retarget on rapid A→B→C.
 *
 * Accessibility: `role="tablist"` + `role="tab"` + `aria-selected`; roving ← → Home End.
 */
export const SegmentedControl = forwardRef<HTMLDivElement, SegmentedControlProps>(
  function SegmentedControl(
    { segments, selected, defaultSelected, onChange, className, ...rest },
    ref,
  ) {
    const [value, setValue] = useControllableState<number>({
      value: selected,
      defaultValue: defaultSelected ?? 0,
      onChange,
    })

    const listRef = useRef<HTMLDivElement>(null)
    const activeRef = useRef<HTMLButtonElement>(null)
    const [pill, setPill] = useState({ x: 0, w: 0, ready: false })

    useLayoutEffect(() => {
      const move = () => {
        const el = activeRef.current
        if (!el) return
        setPill({ x: el.offsetLeft, w: el.offsetWidth, ready: true })
      }
      move()
      const ro = new ResizeObserver(move)
      if (listRef.current) ro.observe(listRef.current)
      return () => ro.disconnect()
    }, [value, segments])

    const select = (index: number) => {
      if (index !== value) setValue(index)
    }

    const focusIndex = (index: number) => {
      const count = segments.length
      if (count === 0) return
      const next = ((index % count) + count) % count
      buttonsRef.current[next]?.focus()
      select(next)
    }

    const buttonsRef = useRef<(HTMLButtonElement | null)[]>([])

    const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          event.preventDefault()
          focusIndex(index + 1)
          break
        case 'ArrowLeft':
        case 'ArrowUp':
          event.preventDefault()
          focusIndex(index - 1)
          break
        case 'Home':
          event.preventDefault()
          focusIndex(0)
          break
        case 'End':
          event.preventDefault()
          focusIndex(segments.length - 1)
          break
        default:
          break
      }
    }

    return (
      <div ref={(n) => { listRef.current = n; if (typeof ref === "function") ref(n); else if (ref) (ref as any).current = n; }} role="tablist" className={cn('ios27-segmented', className)} {...rest}>
        <span
          className="ios27-segmented__pill"
          aria-hidden="true"
          style={{
            transform: `translateX(${pill.x}px)`,
            width: pill.w,
            opacity: pill.ready ? 1 : 0,
          }}
        />
        {segments.map((label, index) => {
          const isActive = index === value
          return (
            <button
              key={label}
              type="button"
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              ref={(node) => {
                buttonsRef.current[index] = node
                if (isActive) activeRef.current = node
              }}
              className={cn(
                'ios27-segmented-item',
                isActive && 'is-active',
              )}
              onClick={() => select(index)}
              onKeyDown={(event) => handleKeyDown(event, index)}
            >
              {label}
            </button>
          )
        })}
      </div>
    )
  },
)
