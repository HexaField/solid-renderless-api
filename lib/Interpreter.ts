import jsonLogic from 'json-logic-js'
import { createRoot } from 'solid-js'
import * as Solid from './solid'

// --- Types ---
export type LogicRule = object | string | number | boolean | any[] | null
export type DataContext = Record<string, any>

export interface LazyNode {
  __lazy: true
  rule: LogicRule
}

function isLazyNode(node: any): node is LazyNode {
  return node && typeof node === 'object' && '__lazy' in node && node.__lazy === true && 'rule' in node
}

// --- Context Management ---
let currentContext: DataContext = {}

/**
 * Execute logic with a specific context.
 * This wraps jsonLogic.apply to ensure we track the current context
 * so custom operators can access it (e.g. for creating closures).
 *
 * @param logic - The JSON Logic rule(s) to execute.
 * @param data - The data context for execution.
 * @returns The result of the execution.
 */
export function exec(logic: LogicRule, data: DataContext = {}) {
  const prevContext = currentContext
  currentContext = data
  try {
    if (isLazyNode(logic)) {
      // If we are asked to exec a lazy node directly (unwrapping it), we just run the rule.
      return exec(logic.rule, data)
    }
    return jsonLogic.apply(logic as any, data)
  } finally {
    currentContext = prevContext
  }
}

// --- Custom Operators ---

// $state: Returns the getter. Attach setter to it.
jsonLogic.add_operation('$state', function (initialValue: any) {
  const [get, set] = Solid.State(initialValue)
  const getter = get as any
  getter.set = set
  return getter
})

// $global: Wraps Global
jsonLogic.add_operation('$global', function (key: string, initial: any) {
  const [get, set] = Solid.Global(key, initial)
  const getter = get as any
  getter.set = set
  return getter
})

// $set: ref.set(val)
jsonLogic.add_operation('$set', function (ref: any, value: any) {
  if (ref && typeof ref.set === 'function') {
    return ref.set(value)
  }
  return undefined
})

// $effect: Effect(rule)
// usage: { "$effect": { "__lazy": true, "rule": ... } }
jsonLogic.add_operation('$effect', function (lazyOrValue: any) {
  const ctx = currentContext
  Solid.Effect(() => {
    if (isLazyNode(lazyOrValue)) {
      exec(lazyOrValue.rule, ctx)
    } else {
      // If passed a non-lazy value, it does nothing reactivity-wise unless the value itself is reactive?
      // But jsonLogic evaluates args before passing.
      // So we really expect a LazyNode block for effects.
    }
  })
})

// $cleanup: Cleanup(rule)
jsonLogic.add_operation('$cleanup', function (lazyNode: any) {
  const ctx = currentContext
  Solid.Cleanup(() => {
    if (isLazyNode(lazyNode)) {
      exec(lazyNode.rule, ctx)
    }
  })
})

// $show: Show(when, children, fallback)
jsonLogic.add_operation('$show', function (when: any, childrenLazy: any, fallbackLazy: any) {
  const ctx = currentContext
  return Solid.Show(
    () => (isLazyNode(when) ? exec(when.rule, ctx) : when),
    () => {
      if (isLazyNode(childrenLazy)) return exec(childrenLazy.rule, ctx)
      return childrenLazy
    },
    () => {
      if (isLazyNode(fallbackLazy)) return exec(fallbackLazy.rule, ctx)
      return fallbackLazy
    }
  )
})

// $for: For(each, children)
jsonLogic.add_operation('$for', function (list: any, childLazy: any) {
  const ctx = currentContext
  return Solid.For(list, (item, index) => {
    // Inject item into context.
    const childCtx = { ...ctx, item: item, index: index }
    if (isLazyNode(childLazy)) {
      exec(childLazy.rule, childCtx)
    }
  })
})

// Helper: Call a function (useful to invoke signal getters or other functions)
// Usage: { "call": [ fn, arg1, arg2 ] }
jsonLogic.add_operation('call', function (fnOrName: any, ...args: any[]) {
  if (typeof fnOrName === 'function') {
    return fnOrName(...args)
  }
  return undefined
})

// Helper: Log to console
jsonLogic.add_operation('log', function (msg: any) {
  console.log(msg)
  return msg
})

// Helper: Sequence (run multiple rules, return last result)
// Usage: { "seq": [ rule1, rule2, ... ] }
jsonLogic.add_operation('seq', function (...rules: any[]) {
  return rules[rules.length - 1]
})

// Helper: Define a local variable in context and run a rule
// Usage: { "def": ["varName", value, ruleToRun] }
jsonLogic.add_operation('def', function (name: string, value: any, rule: any) {
  const ctx = { ...currentContext, [name]: value }
  return exec(rule, ctx)
})

// Helper: Create a function from a rule (lambda)
// Usage: { "lambda": { "__lazy": true, "rule": ... } }
jsonLogic.add_operation('lambda', function (rule: any) {
  const ctx = currentContext
  return (..._args: any[]) => {
    // We could capture args here if we wanted to inject them into a new context
    // For now, assuming context is captured from definition + args not exposed unless logic
    // But lambda args are useful. Let's expose them as "args" array or named?
    // User didn't ask for generic lambda args, but `setInterval` callback might need none.
    // If args are needed, we can add { ...ctx, args: args }
    return exec(isLazyNode(rule) ? rule.rule : rule, ctx)
  }
})

// --- Main Runner ---

/**
 * Main entry point for the interpreter.
 * Wraps the execution in a SolidJS reactive root to support signals and effects.
 *
 * @param json - The JSON Logic tree to execute.
 * @param initialData - Initial data context.
 * @returns The result of the execution.
 */
export function runLogic(json: LogicRule, initialData: DataContext = {}) {
  // Requirement: "wraps the entire execution in createRoot"
  return createRoot((dispose) => {
    const result = exec(json, initialData)

    // "Mount" the result: if it's a function (signal/memo/component),
    // we must observe it to trigger lazy evaluations (like Show/For).
    // In headless, if result is just settings up effects, it works.
    // If result return a JSX Element (undefined in our Solid.ts), it's fine.

    // We export dispose for manual cleanup if needed
    return { result, dispose }
  })
}
