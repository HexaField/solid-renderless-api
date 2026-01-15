import { describe, it, expect } from 'vitest'
import { createRoot, createSignal, createEffect } from 'solid-js'
import { Show, For, Child, Effect, Cleanup } from './solid'

// Helper to wait for Solid's microtask queue (effects)
const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('Renderless API', () => {
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

  it('Comp: passes props to component', async () => {
    let receivedProps: { foo: string } | null = null

    // Test Component
    const MyComp = (props: { foo: string }) => {
      receivedProps = props
      return 'rendered'
    }

    await createRoot(async (dispose) => {
      // Create component once
      Child(MyComp, { foo: 'bar' })
      await tick()

      expect(receivedProps).toEqual(expect.objectContaining({ foo: 'bar' }))
      dispose()
    })
  })

  it('Show: toggles between children and fallback', async () => {
    const [visible, setVisible] = createSignal(true)
    const logs: string[] = []

    const Comp = () => {
      Effect(() => {
        logs.push('Comp Mounted')
        Cleanup(() => logs.push('Comp Unmounted'))
      })
      return 'CompNode'
    }

    const Fallback = () => {
      logs.push('Fallback Active')
      return 'FallbackNode'
    }

    await createRoot(async (dispose) => {
      // Define the reactive graph
      const view = Show(
        visible,
        () => Child(Comp),
        () => Fallback()
      )

      // Force read the view recursively to ensure execution
      createEffect(() => {
        let v: unknown = view
        while (typeof v === 'function') {
          v = (v as () => unknown)()
        }
      })

      await tick()
      expect(logs).toContain('Comp Mounted')
      expect(logs).not.toContain('Fallback Active')

      // Toggle
      logs.length = 0
      setVisible(false)

      await tick()
      expect(logs).toContain('Comp Unmounted')
      expect(logs).toContain('Fallback Active')

      dispose()
    })
  })

  it('For: renders list and handles updates', async () => {
    const [items, setItems] = createSignal([1, 2])
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
      createEffect(() => {
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
})
