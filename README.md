# Solid Renderless API

A minimal, zero-cost abstraction library for building **Reactive Logic Trees** using SolidJS.

This library allows you to build purely logical component trees that participate in Solid's **Reactive Graph (Ownership Tree)** to manage process lifecycles, state machines, and side effects without the overhead of UI rendering or VDOM reconciliation.

## The Conccept

In traditional component frameworks, components are mechanisms for organizing pixels ("Space"). This library treats components as mechanisms for organizing logic and lifecycle ("Time").

*   **Renderless Components:** Components that return `null`. They exist solely to hook into the mounting/unmounting lifecycle of the framework.
*   **Zero-Cost Abstraction:** Since SolidJS has no Virtual DOM, a "renderless component" is just a function call that creates a reactive scope. There is no diffing overhead.
*   **Services/Managers:** Use components as ephemeral micro-services that spin up, perform a job, and clean up automatically when their parent condition changes.

## API Reference

### 1. Control Flow

Replaces JSX control flow with pure function calls.

```typescript
import { Show, For } from './lib/solid'

// Conditional Logic
Show(
  isValid, 
  () => console.log("Valid state active"),
  () => console.log("Invalid state fallback")
)

// Iteration
For(users, (user) => {
  Effect(() => console.log("Syncing user:", user.id))
  Cleanup(() => console.log("Stop syncing:", user.id))
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
  console.log("Count is now", count())
})

// Lifecycle Teardown
Cleanup(() => {
  console.log("Component scope destroying...")
})
```

### 3. Composition

**`Child`** allows you to nest other logic components, maintaining the ownership tree for context and disposal.

```typescript
import { Child } from './lib/solid'

Child(MyWorkerComponent, { url: '/api/stream' })
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
  Show(isActive, () => Child(Poller, { url: 'https://api.example.com' }))
}
```
