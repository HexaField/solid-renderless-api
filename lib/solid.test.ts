import { describe, it, expect, } from 'vitest'
import { createRoot } from 'solid-js'
import { Show, For, Child, Effect, Cleanup, Global, State } from './solid'

// Helper to wait for Solid's microtask queue (effects)
const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('Renderless API', () => {
  it('State: creates a signal', () => {
    createRoot((dispose) => {
      const [count, setCount] = State(0)
      expect(count()).toBe(0)
      setCount(1)
      expect(count()).toBe(1)
      dispose()
    })
  })

  it('Global: defines and retrieves keys', () => {
    createRoot((dispose) => {
      // Define
      const [g1] = Global('test-key', 100)
      expect(g1()).toBe(100)

      // Retrieve
      const [g2] = Global<number>('test-key')
      expect(g2()).toBe(100)
      expect(g1).toBe(g2)

      dispose()
    })
  })

  it('Global: persists across scopes', async () => {
    // Scope 1: Define
    createRoot((dispose) => {
      const [, setVal] = Global('shared', 'A')
      setVal('B')
      dispose()
    })

    // Scope 2: Access
    // Note: createSignal is not owned by root unless effect/computations inside depend on it.
    // The signal itself survives.
    await createRoot(async (dispose) => {
      const [val] = Global<string>('shared')
      expect(val()).toBe('B')
      dispose()
    })
  })

  it('Effect & Cleanup: runs effect and cleans up', async () => {
    const logs: string[] = []

    await createRoot(async (dispose) => {
      Effect(() => {
        logs.push('effect ran')
        Cleanup(() => logs.push('cleanup ran'))
      })

      await tick()
      expect(logs).toContain('effect ran')
      expect(logs).not.toContain('cleanup ran')

      dispose()
    })

    expect(logs).toContain('cleanup ran')
  })

  it('Child: passes props to component', async () => {
    let receivedProps: { foo: string } | null = null
    let chilrenRendered = false

    // Test Component
    const MyComp = (props: { foo: string; children?: any }) => {
      receivedProps = props
      if (props.children) {
        chilrenRendered = true
      }
      return 'rendered'
    }

    await createRoot(async (dispose) => {
      // Create component once
      Child(MyComp, { foo: 'bar' }, 'Kids' as any)
      await tick()

      expect(receivedProps).toEqual(expect.objectContaining({ foo: 'bar' }))
      expect(chilrenRendered).toBe(true)
      dispose()
    })
  })

  it('Show: toggles between children and fallback', async () => {
    const [visible, setVisible] = State(true)
    const logs: string[] = []

    const Content = () => {
      Effect(() => {
        logs.push('Child Mounted')
        Cleanup(() => logs.push('Child Unmounted'))
      })
      return 'ChildNode'
    }

    const Fallback = () => {
      logs.push('Fallback Active')
      return 'FallbackNode'
    }

    await createRoot(async (dispose) => {
      // Define the reactive graph
      const view = Show(
        visible,
        () => Child(Content),
        () => Fallback()
      )

      // Force read the view recursively to ensure execution
      Effect(() => {
        let v: unknown = view
        while (typeof v === 'function') {
          v = (v as () => unknown)()
        }
      })

      await tick()
      expect(logs).toContain('Child Mounted')
      expect(logs).not.toContain('Fallback Active')

      // Toggle
      logs.length = 0
      setVisible(false)

      await tick()
      expect(logs).toContain('Child Unmounted')
      expect(logs).toContain('Fallback Active')

      dispose()
    })
  })

  it('For: renders list and handles updates', async () => {
    const [items, setItems] = State([1, 2])
    const mounted: number[] = []
    const unmounted: number[] = []

    const Item = (props: { id: number }) => {
      Effect(() => {
        mounted.push(props.id)
        Cleanup(() => unmounted.push(props.id))
      })
      return 'ItemNode'
    }

    await createRoot(async (dispose) => {
      // Define graph ONCE
      const view = For(items, (id: number) => Child(Item, { id }))

      // Observe
      Effect(() => {
        const v = view
        if (typeof v === 'function') (v as () => void)()
      })

      await tick()
      expect(mounted).toEqual([1, 2])

      // Add item
      setItems([1, 2, 3])
      await tick()
      expect(mounted).toEqual([1, 2, 3])

      // Remove item
      setItems([1, 3])
      await tick()
      expect(unmounted).toEqual([2])

      dispose()
      await tick()
      expect(unmounted).toEqual(expect.arrayContaining([1, 2, 3]))
    })
  })

  it('Integration: Global state drives rendering', async () => {
    const [page, setPage] = Global('current-page', 'home')
    const mounts: string[] = []

    const PageComp = (props: { name: string }) => {
      Effect(() => {
        mounts.push(props.name)
        Cleanup(() => {
          /* cleanup */
        })
      })
      return props.name
    }

    await createRoot(async (dispose) => {
      const router = Show(
        () => page() === 'home',
        () => Child(PageComp, { name: 'Home' }),
        () => Child(PageComp, { name: 'Other' })
      )

      Effect(() => {
        // Drive the output
        let v: any = router
        while (typeof v === 'function') {
          v = v()
        }
      })

      await tick()
      expect(mounts).toContain('Home')

      // Switch page via global setter
      setPage('data')
      await tick()
      expect(mounts).toContain('Other')

      dispose()
    })
  })
})
