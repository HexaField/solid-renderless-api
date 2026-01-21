import { describe, it, expect } from 'vitest'
import { createRoot } from 'solid-js'
import { Show, For, Effect, Cleanup, Global, State, resetGlobalStates } from './solid'

// Helper to wait for Solid's microtask queue (effects)
const tick = () => new Promise((resolve) => setTimeout(resolve, 0))
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

type Task = { id: number; name: string; priority: 'high' | 'low' }

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

describe('Componentized Integration Example', () => {
  it('Task System runs correctly with components and async scheduling', async () => {
    const logs: string[] = []
    const log = (msg: string) => logs.push(msg)

    // Component: Individual Task Monitor
    function TaskMonitor(props: { task: Task; index: () => number; onCleanup: () => void }) {
      Effect(() => {
        log(`[TASK] Monitor: Task #${props.task.id} "${props.task.name}" is in queue at pos ${props.index()}`)
      })

      // Handle specific priority
      Show(
        () => props.task.priority === 'high',
        () => log(`  -> [ALERT] High priority task detected: ${props.task.name}`)
      )

      // Cleanup if task is removed from list or system stops
      Cleanup(() => {
        log(`[TASK] Cleanup: Task #${props.task.id} removed or processing stopped.`)
        props.onCleanup()
      })
    }

    // Component: The Logic Engine
    function ProcessingEngine(props: { tasks: () => Task[]; onTaskProcessed: () => void }) {
      log('[LOGIC] Processing Engine Started')

      // Iterate over tasks
      For(props.tasks, (task, index) => {
        TaskMonitor({
          task,
          index,
          onCleanup: props.onTaskProcessed
        })
      })

      // Cleanup for the generic engine
      Cleanup(() => log('[LOGIC] Processing Engine Halted'))
    }

    await createRoot(async (dispose) => {
      // 1. Global Configuration
      // Use unique key to avoid collision with other tests
      const [systemStatus, setSystemStatus] = Global('system_status_integration_test', 'IDLE')

      // 2. Local State
      const [tasks, setTasks] = State<Task[]>([])
      const [processedCount, setProcessedCount] = State(0)

      log('--- System Initialized ---')

      // 3. React to System Status
      Effect(() => {
        log(`[STATUS CHANGE] System is now: ${systemStatus()}`)
      })

      // 4. Main Processing Logic
      Show(
        () => systemStatus() === 'RUNNING',
        // Mount the engine component
        () =>
          ProcessingEngine({
            tasks,
            onTaskProcessed: () => setProcessedCount((p) => p + 1)
          }),
        // Fallback when not RUNNING
        () => log('[LOGIC] System is paused. Waiting for command.')
      )

      // Initial State Check
      await tick()
      expect(logs).toContain('[LOGIC] System is paused. Waiting for command.')
      expect(logs).toContain('[STATUS CHANGE] System is now: IDLE')

      // Start System
      setSystemStatus('RUNNING')
      await tick()
      expect(logs).toContain('[STATUS CHANGE] System is now: RUNNING')
      expect(logs).toContain('[LOGIC] Processing Engine Started')

      // Add Tasks
      await sleep(10) // Simulate async arrival
      setTasks([
        { id: 1, name: 'Database Backup', priority: 'low' },
        { id: 2, name: 'Critical Security Patch', priority: 'high' }
      ])
      await tick()

      expect(logs).toContain('  -> [ALERT] High priority task detected: Critical Security Patch')
      expect(logs.some((l) => l.includes('Task #1 "Database Backup" is in queue at pos 0'))).toBe(true)

      // Modify List (swap)
      log('--- Reordering Tasks ---')
      setTasks((prev) => [prev[1], prev[0]])
      await tick()

      // Note: Solid For keyed updates might handle swaps efficiently or by recreation depending on implementation.
      // If index is reactive, it should just update index indices if items are moved?
      // With For in Solid, swapping elements in array usually moves the DOM nodes (or logic execution contexts).
      // Here, index() is a signal.
      expect(logs.some((l) => l.includes('Task #1 "Database Backup" is in queue at pos 1'))).toBe(true)

      // Remove a task
      log('--- Completing Task #2 ---')
      setTasks((prev) => prev.filter((t) => t.id !== 2))
      await tick()

      // Task 2 cleanup should have run
      expect(logs).toContain('[TASK] Cleanup: Task #2 removed or processing stopped.')
      expect(processedCount()).toBe(1)

      // Stop System
      log('--- Stopping System ---')
      setSystemStatus('STOPPED')
      await tick()

      expect(logs).toContain('[LOGIC] Processing Engine Halted')
      expect(logs).toContain('[LOGIC] System is paused. Waiting for command.')

      // Task 1 cleanup should have run when system stopped
      expect(logs).toContain('[TASK] Cleanup: Task #1 removed or processing stopped.')

      // processedCount should be 2 now (Task 2 removed earlier + Task 1 removed on stop)
      expect(processedCount()).toBe(2)

      dispose()
    })
  })
})
