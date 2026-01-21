import {
  createComputed,
  onCleanup,
  createSignal,
  mapArray,
  type Accessor,
  type JSX,
  type SignalOptions,
  type Signal
} from 'solid-js'

export type RenderlessElement = JSX.Element | void

const r = <T>(val: T | Accessor<T>): Accessor<T> => (typeof val === 'function' ? (val as Accessor<T>) : () => val)

/**
 * Control Flow: Show
 * Renders `children` when `when` is truthy, otherwise renders `fallback`.
 * Since this is headless, it executes the children function instead of returning DOM nodes.
 */
export const Show = <T>(
  when: T | Accessor<T>,
  children: RenderlessElement | ((item: NonNullable<T>) => RenderlessElement),
  fallback?: RenderlessElement | (() => RenderlessElement)
): RenderlessElement => {
  const condition = r(when)
  createComputed(() => {
    const c = condition()
    if (c) {
      if (typeof children === 'function') {
        if ((children as Function).length > 0) {
          ;(children as Function)(c)
        } else {
          ;(children as Function)()
        }
      }
    } else {
      if (typeof fallback === 'function') (fallback as Function)()
    }
  })
  return undefined as unknown as JSX.Element
}

/**
 * Control Flow: For
 * Iterates over a list and executes `children` for each item.
 */
export const For = <T>(
  each: readonly T[] | Accessor<readonly T[] | undefined | null> | undefined | null,
  children: (item: T, index: Accessor<number>) => void
): RenderlessElement => {
  const list = r(each)
  const mapped = mapArray(list, (item, index) => {
    children(item, index)
    return undefined // We don't need to return anything, but mapArray expects a return
  })
  createComputed(mapped) // Subscribe to trigger updates
  return undefined as unknown as RenderlessElement
}

/**
 * Reactivity: Effect
 * wrapper for createComputed (synchronous effect for headless)
 */
export const Effect = <T>(fn: (v: T) => T, value?: T): void => {
  createComputed(fn as any, value)
}

/**
 * Reactivity: Cleanup
 * Registers a cleanup function to run when the current reactive scope is disposed.
 */
export const Cleanup = (fn: () => void): void => {
  onCleanup(fn)
}

/**
 * State: State
 * Creates a local reactive state (signal).
 */
export const State = <T>(value: T, options?: SignalOptions<T>): Signal<T> => createSignal(value, options)

const globalSignals = new Map<string, Signal<any>>()

/**
 * State: Global
 * Accesses or creates a shared global signal by key.
 */
export const Global = <T>(key: string, initial?: T): Signal<T> => {
  if (!globalSignals.has(key)) {
    if (initial === undefined) throw new Error(`Global state '${key}' not found`)
    globalSignals.set(key, createSignal(initial))
  }
  return globalSignals.get(key) as Signal<T>
}

export const resetGlobalStates = (): void => globalSignals.clear()
