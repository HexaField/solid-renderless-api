import { describe, it, expect, vi } from 'vitest'
import { createRoot, getOwner } from 'solid-js'
import { runLogic } from './interpreter'
import * as solidApi from './solid'

const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('interpreter', () => {
  it('should run logic inside a createRoot', async () => {
    let owner: any
    runLogic(
      {
        $effect: {
          __lazy: true,
          rule: { call: [{ var: 'saveOwner' }] }
        }
      },
      {
        saveOwner: () => {
          owner = getOwner()
        }
      }
    )

    await tick()
    expect(owner).toBeDefined()
  })

  it('should create a local state with $state', () => {
    const { result: getter } = runLogic({ $state: 10 }) as any
    expect(typeof getter).toBe('function')
    expect(getter()).toBe(10)
    expect(getter.set).toBeDefined()
  })

  it('should get value from $state', () => {
    const { result } = runLogic({ $state: 10 }) as any
    expect(typeof result).toBe('function')
    expect(result()).toBe(10)
  })

  it('should share state via $global', () => {
    runLogic(
      {
        $set: [{ $global: ['testKey', 5] }, 42]
      },
      {}
    )

    createRoot((dispose) => {
      const { Global } = solidApi
      const [get] = Global('testKey')
      expect(get()).toBe(42)
      dispose()
    })
  })

  it('should run effect via $effect', async () => {
    const spy = vi.fn()

    runLogic(
      {
        $effect: {
          __lazy: true,
          rule: { call: [{ var: 'spyVar' }] }
        }
      },
      { spyVar: spy }
    )

    await tick()
    expect(spy).toHaveBeenCalled()
  })

  it('should lazy evaluate $show branches', async () => {
    const positiveSpy = vi.fn()
    const negativeSpy = vi.fn()

    runLogic(
      {
        $show: [
          true,
          { __lazy: true, rule: { call: [{ var: 'pos' }] } },
          { __lazy: true, rule: { call: [{ var: 'neg' }] } }
        ]
      },
      { pos: positiveSpy, neg: negativeSpy }
    )

    await tick()

    expect(positiveSpy).toHaveBeenCalled()
    expect(negativeSpy).not.toHaveBeenCalled()
  })

  it('should iterate with $for', async () => {
    const spy = vi.fn()
    runLogic(
      {
        $for: [
          [1, 2, 3],
          {
            __lazy: true,
            rule: { call: [{ var: 'spy' }, { var: 'item' }] }
          }
        ]
      },
      { spy }
    )

    await tick()
    expect(spy).toHaveBeenCalledTimes(3)
    expect(spy).toHaveBeenCalledWith(1)
    expect(spy).toHaveBeenCalledWith(2)
    expect(spy).toHaveBeenCalledWith(3)
  })

  it('should run the Complex Integration Example via Interpreter', async () => {
    const logs: string[] = []
    const logSpy = (msg: string) => logs.push(msg)

    // The Logic Rule
    const logic = {
      def: [
        'sys',
        { $global: ['sys_status_int', 'IDLE'] },
        {
          __lazy: true,
          rule: {
            def: [
              'tasks',
              { $state: [] },
              {
                __lazy: true,
                rule: {
                  seq: [
                    // Effect for status
                    {
                      $effect: {
                        __lazy: true,
                        rule: {
                          call: [
                            { var: 'log' },
                            {
                              cat: ['[STATUS CHANGE] System is now: ', { call: [{ var: 'sys' }] }]
                            }
                          ]
                        }
                      }
                    },

                    // Main Logic Show
                    {
                      $show: [
                        {
                          __lazy: true,
                          rule: { '===': [{ call: [{ var: 'sys' }] }, 'RUNNING'] }
                        },
                        // Children (Engine)
                        {
                          __lazy: true,
                          rule: {
                            seq: [
                              { call: [{ var: 'log' }, '[LOGIC] Processing Engine Started'] },
                              // For loop
                              {
                                $for: [
                                  { call: [{ var: 'tasks' }] },
                                  {
                                    __lazy: true,
                                    rule: {
                                      seq: [
                                        // Monitor Effect
                                        {
                                          $effect: {
                                            __lazy: true,
                                            rule: {
                                              call: [
                                                { var: 'log' },
                                                {
                                                  cat: [
                                                    '[TASK] Monitor: Task #',
                                                    { var: 'item.id' },
                                                    ' "',
                                                    { var: 'item.name' },
                                                    '" is in queue at pos ',
                                                    { call: [{ var: 'index' }] }
                                                  ]
                                                }
                                              ]
                                            }
                                          }
                                        },
                                        // High Priority Alert
                                        {
                                          $show: [
                                            { '===': [{ var: 'item.priority' }, 'high'] },
                                            {
                                              __lazy: true,
                                              rule: {
                                                call: [
                                                  { var: 'log' },
                                                  {
                                                    cat: [
                                                      '  -> [ALERT] High priority task detected: ',
                                                      { var: 'item.name' }
                                                    ]
                                                  }
                                                ]
                                              }
                                            }
                                          ]
                                        },
                                        // Cleanup
                                        {
                                          $cleanup: {
                                            __lazy: true,
                                            rule: {
                                              call: [
                                                { var: 'log' },
                                                {
                                                  cat: [
                                                    '[TASK] Cleanup: Task #',
                                                    { var: 'item.id' },
                                                    ' removed or processing stopped.'
                                                  ]
                                                }
                                              ]
                                            }
                                          }
                                        }
                                      ]
                                    }
                                  }
                                ]
                              },
                              // Engine Cleanup
                              {
                                $cleanup: {
                                  __lazy: true,
                                  rule: {
                                    call: [{ var: 'log' }, '[LOGIC] Processing Engine Halted']
                                  }
                                }
                              }
                            ]
                          }
                        },
                        // Fallback
                        {
                          __lazy: true,
                          rule: {
                            call: [{ var: 'log' }, '[LOGIC] System is paused. Waiting for command.']
                          }
                        }
                      ]
                    },

                    // Return controls
                    [{ var: 'sys' }, { var: 'tasks' }]
                  ]
                }
              }
            ]
          }
        }
      ]
    }

    // Run Logic
    const { result, dispose } = runLogic(logic, { log: logSpy })
    const [sys, tasks] = result as [any, any]

    // --- Simulation Steps (matching components.test.ts) ---

    // Initial State Check
    await tick()
    expect(logs).toContain('[LOGIC] System is paused. Waiting for command.')
    expect(logs).toContain('[STATUS CHANGE] System is now: IDLE')

    // Start System
    sys.set('RUNNING')
    await tick()
    expect(logs).toContain('[STATUS CHANGE] System is now: RUNNING')
    expect(logs).toContain('[LOGIC] Processing Engine Started')

    // Add Tasks
    tasks.set([
      { id: 1, name: 'Database Backup', priority: 'low' },
      { id: 2, name: 'Critical Security Patch', priority: 'high' }
    ])
    await tick()

    expect(logs).toContain('  -> [ALERT] High priority task detected: Critical Security Patch')
    expect(logs.some((l) => l.includes('Task #1 "Database Backup" is in queue at pos 0'))).toBe(true)

    // Modify List (swap)
    tasks.set((prev: any[]) => [prev[1], prev[0]])
    await tick()

    expect(logs.some((l) => l.includes('Task #1 "Database Backup" is in queue at pos 1'))).toBe(true)

    // Remove a task
    tasks.set((prev: any[]) => prev.filter((t: any) => t.id !== 2))
    await tick()

    // Task 2 cleanup
    expect(logs).toContain('[TASK] Cleanup: Task #2 removed or processing stopped.')

    // Stop System
    sys.set('STOPPED')
    await tick()

    expect(logs).toContain('[LOGIC] Processing Engine Halted')
    expect(logs).toContain('[LOGIC] System is paused. Waiting for command.')

    // Task 1 cleanup
    expect(logs).toContain('[TASK] Cleanup: Task #1 removed or processing stopped.')

    dispose()
  })
})
