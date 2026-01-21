import { describe, it, expect } from 'vitest'
import { createRoot } from 'solid-js'
import { Show, For, Effect, Cleanup, Global, State, resetGlobalStates } from './solid'

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
      // They are the same signal value
      expect(g1()).toBe(g2())

      dispose()
    })
  })

  it('Effect: runs immediately and reacts', async () => {
    let result = 0
    await createRoot(async (dispose) => {
      const [count, setCount] = State(10)

      Effect(() => {
        result = count()
      })

      expect(result).toBe(10)

      setCount(20)
      await tick()
      expect(result).toBe(20)

      dispose()
    })
  })

  it('Show: executes children when true', async () => {
    let active = false
    await createRoot(async (dispose) => {
      const [visible, setVisible] = State(false)

      Show(
        visible,
        () => {
          active = true
          return undefined as any
        },
        () => {
          active = false
          return undefined as any
        }
      )

      expect(active).toBe(false)

      setVisible(true)
      await tick()
      expect(active).toBe(true)

      setVisible(false)
      await tick()
      expect(active).toBe(false)

      dispose()
    })
  })

  it('For: iterates and reacts to list changes', async () => {
    let output: string[] = []
    await createRoot(async (dispose) => {
      const [list, setList] = State<string[]>(['a', 'b'])

      For(list, (item, index) => {
        output.push(`${item}-${index()}`)
        Cleanup(() => {
          output.push(`remove-${item}`)
        })
      })

      // Initial run
      expect(output).toEqual(['a-0', 'b-1'])

      output = []
      setList(['a', 'c'])
      await tick()

      expect(output).toContain('remove-b')
      expect(output).toContain('c-1')

      dispose()
    })
  })

  it('resetGlobalStates: clears all global signals', () => {
    createRoot((dispose) => {
      // Set a global
      Global('persist-test', 123)

      // Verify it is there
      expect(Global<number>('persist-test')[0]()).toBe(123)

      // Reset
      resetGlobalStates()

      // Expect error on retrieval
      expect(() => {
        Global('persist-test')
      }).toThrow()

      // Should be able to recreate
      Global('persist-test', 456)
      expect(Global<number>('persist-test')[0]()).toBe(456)

      dispose()
    })
  })
})
