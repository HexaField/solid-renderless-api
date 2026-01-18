# Solid Renderless API

A minimal, zero-cost abstraction library for building **Reactive Logic Trees** using SolidJS.

This library allows you to build purely logical component trees that participate in Solid's **Reactive Graph (Ownership Tree)** to manage process lifecycles, state machines, and side effects without the overhead of UI rendering or VDOM reconciliation.

## The Conccept

In traditional component frameworks, components are mechanisms for organizing pixels ("Space"). This library treats components as mechanisms for organizing logic and lifecycle ("Time").

- **Renderless Components:** Components that return `null`. They exist solely to hook into the mounting/unmounting lifecycle of the framework.
- **Zero-Cost Abstraction:** Since SolidJS has no Virtual DOM, a "renderless component" is just a function call that creates a reactive scope. There is no diffing overhead.
- **Services/Managers:** Use components as ephemeral micro-services that spin up, perform a job, and clean up automatically when their parent condition changes.

## API Reference

### 1. Control Flow

Replaces JSX control flow with pure function calls.

```typescript
import { Show, For } from './lib/solid'

// Conditional Logic
Show(
  isValid,
  () => console.log('Valid state active'),
  () => console.log('Invalid state fallback')
)

// Iteration
For(users, (user) => {
  Effect(() => console.log('Syncing user:', user.id))
  Cleanup(() => console.log('Stop syncing:', user.id))
})
```

### 2. State & Lifecycle

Wrappers for Solid's primitives to keep syntax consistent.

```typescript
import { State, Global, Effect, Cleanup } from './lib/solid'

// Local State (createSignal)
const [count, setCount] = State(0)

// Global Shared State (Singleton by key)
const [theme, setTheme] = Global('theme', 'dark')

// Side Effects
Effect(() => {
  console.log('Count is now', count())
})

// Lifecycle Teardown
Cleanup(() => {
  console.log('Component scope destroying...')
})
```

## Example: Polling Service

This "component" manages a polling interval. It doesn't render anything, but it starts when mounted and stops cleanly when unmounted/disposed.

```typescript
const Poller = (props) => {
  Effect(() => {
    const id = setInterval(() => {
      console.log(`Polling ${props.url}...`)
    }, 1000)

    Cleanup(() => clearInterval(id))
  })
}

// Usage in your logic tree
const AppLogic = () => {
  const [isActive, setActive] = State(false)

  // The Poller only exists (and polls) when isActive is true
  Show(isActive, () => Poller({ url: 'https://api.example.com' }))
}
```

## JSON Logic Interpreter

The library includes an enhanced `json-logic-js` interpreter customized for reactive applications.

### 1. Running Logic

Use `runLogic` to execute a JSON Logic tree within a reactive root.

```typescript
import { runLogic } from './lib/interpreter'

const logic = {
  "$state": 0
}

const { result, dispose } = runLogic(logic)
```

### 2. Custom Operators

| Operator | Usage | Description |
| :--- | :--- | :--- |
| **$state** | `{"$state": <initial>}` | Creates a local signal. Returns getter (with .set attached). |
| **$global** | `{"$global": ["key", <initial>]}` | Accesses or creates a shared global signal. |
| **$set** | `{"$set": [<ref>, <value>]}` | Updates a signal value. |
| **$effect** | `{"$effect": { "__lazy": true, "rule": ... }}` | Runs a side effect. Rule must be lazy. |
| **$cleanup** | `{"$cleanup": { "__lazy": true, "rule": ... }}` | Register cleanup callback. |
| **$show** | `{"$show": [<when>, <lazy_true>, <lazy_false>]}` | Conditional rendering. Branches must be lazy. |
| **$for** | `{"$for": [<list>, <lazy_child>]}` | Iteration. Child rule runs for each item. |
| **def** | `{"def": ["name", <val>, <rule>]}` | Defines a local variable in context. |
| **call** | `{"call": [<fn>, ...args]}` | Call a function ref (e.g. from context). |

### 3. Lazy Evaluation
Control flow operators (`$show`, `$for`, `$effect`) require their bodies to be wrapped in a "Lazy Node" to prevent immediate execution by the JSON parser.

**Lazy Node Syntax:**
```json
{ "__lazy": true, "rule": { ... your logic ... } }
```

**Example:**
```json
{
  "$show": [
    { "$state": true },
    { "__lazy": true, "rule": { "log": "Active" } },
    { "__lazy": true, "rule": { "log": "Inactive" } }
  ]
}
```
