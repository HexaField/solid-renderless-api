import { describe, it, expect, vi } from 'vitest'
import { createRoot, getOwner } from 'solid-js'
import { runLogic } from './Interpreter'
import * as solidApi from './solid'

const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('Interpreter', () => {
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
})
