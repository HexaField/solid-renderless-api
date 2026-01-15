import {
  createComponent,
  Show as SolidShow,
  For as SolidFor,
  createEffect,
  onCleanup,
  type JSX,
  type Component,
  type Accessor,
  type ComponentProps
} from 'solid-js'

// Helper: ensures reactive values are accessed as functions
const r = <T>(val: T | Accessor<T>): Accessor<T> => (typeof val === 'function' ? (val as Accessor<T>) : () => val)

// 1. Control Flow
// We accept children as Element or Callback (Keyed)
export const Show = <T>(
  when: T | Accessor<T>,
  children: JSX.Element | ((item: NonNullable<T>) => JSX.Element),
  fallback?: JSX.Element | (() => JSX.Element)
): JSX.Element =>
  createComponent(SolidShow, {
    get when() {
      return r(when)()
    },
    get fallback() {
      return fallback
    },
    children
  } as ComponentProps<typeof SolidShow>)

export const For = <T, U extends JSX.Element>(
  each: readonly T[] | Accessor<readonly T[] | undefined | null> | undefined | null,
  children: (item: T, index: Accessor<number>) => U
): JSX.Element =>
  createComponent(SolidFor, {
    get each() {
      return r(each)()
    },
    children
  })

// 2. Component Composition
export const Child = <P extends object>(component: Component<P>, props?: P, children?: JSX.Element): JSX.Element =>
  createComponent(component, {
    ...(props || {}),
    get children() {
      return children
    }
  } as unknown as P)

// 3. Effects & Lifecycle
export const Effect = <T>(fn: (v: T | undefined) => T) => createEffect(fn)
export const Cleanup = (fn: () => void) => onCleanup(fn)
