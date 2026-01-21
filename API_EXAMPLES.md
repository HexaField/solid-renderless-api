# Solid Renderless API Examples

This document demonstrates the capabilities of the `solid-renderless-api` library. This library provides a set of reactive primitives and control flow utilities designed for "headless" logic execution—perfect for state management, terminal applications, or background processes that need fine-grained reactivity without the DOM.

## Table of Contents

- [State Management](#state-management)
- [Side Effects (`Effect`)](#side-effects)
- [Conditional Logic (`Show`)](#conditional-logic-show)
- [List Iteration (`For`)](#list-iteration-for)
- [Global State (`Global`)](#global-state-global)
- [Resource Cleanup (`Cleanup`)](#resource-cleanup-cleanup)
- [Complex Integration Example](#complex-integration-example)

---

## State Management

Use `State` to create local reactive signals. This is a wrapper around SolidJS `createSignal`.

```typescript
import { State } from './lib/solid';

// Create a reactive state
const [count, setCount] = State(0);

console.log(count()); // 0

setCount(1);
console.log(count()); // 1

// Functional updates
setCount((prev) => prev + 1);
```

---

## Side Effects

Use `Effect` to run side effects purely in response to state changes. This is a synchronous wrapper around `createComputed`.

```typescript
import { State, Effect } from './lib/solid';

const [userId, setUserId] = State<number | null>(null);

Effect(() => {
  const id = userId();
  if (id) {
    console.log(`User Logged In: ${id}`);
  } else {
    console.log('Waiting for user...');
  }
});

setUserId(101); // Logs: "User Logged In: 101"
setUserId(null); // Logs: "Waiting for user..."
```

---

## Conditional Logic (`Show`)

`Show` performs logic conditionally. Since this is renderless, `children` and `fallback` are functions executed when the condition changes, rather than returning DOM nodes.

### Basic Toggle

```typescript
import { State, Show } from './lib/solid';

const [isEnabled, setEnabled] = State(false);

Show(
  isEnabled,
  // Executed when true
  () => console.log("System is ONLINE"),
  // Executed when false (Fallback)
  () => console.log("System is OFFLINE")
);

setEnabled(true);  // Logs: "System is ONLINE"
setEnabled(false); // Logs: "System is OFFLINE"
```

### Accessing the Truthy Value

The `children` callback receives the non-nullable value of the condition.

```typescript
import { State, Show } from './lib/solid';

const [data, setData] = State<{ name: string } | null>(null);

Show(
  data,
  // 'item' is strictly types as { name: string } here
  (item) => console.log(`Processing: ${item.name}`),
  () => console.log("No data available")
);

setData({ name: 'Task A' }); // Logs: "Processing: Task A"
```

---

## List Iteration (`For`)

`For` is used for efficient list iteration. It reacts to array changes and executes its children function for each item.

```typescript
import { State, For } from './lib/solid';

const [users, setUsers] = State(['Alice', 'Bob']);

// The callback runs for each item.
// Note: 'index' is an Accessor function to track position changes.
For(users, (user, index) => {
  console.log(`Added user: ${user}`);

  // You can create effects per-item
  Effect(() => {
    console.log(`${user} is at index ${index()}`);
  });
});

// Adding a user triggers the callback for ONLY the new item
setUsers([...users(), 'Charlie']);
// Logs:
// "Added user: Charlie"
// "Charlie is at index 2"
```

---

## Global State (`Global`)

`Global` provides a shared state mechanism using keys. Useful for sharing data across decoupled parts of your application without prop drilling.

```typescript
import { Global, Effect } from './lib/solid';

// Module A: Defines the global
const [theme, setTheme] = Global('app_theme', 'light');

// Module B: Consumes the global (somewhere else)
// If the global exists, usage matches the existing signal.
const [currentTheme] = Global<string>('app_theme');

Effect(() => {
  console.log(`Theme switched to: ${currentTheme()}`);
});

setTheme('dark'); // Logs: "Theme switched to: dark"
```

---

## Resource Cleanup (`Cleanup`)

`Cleanup` (wrapper for `onCleanup`) allows you to release resources (timers, subscriptions) when a reactive scope (like a `Show` or `For` item) is disposed.

```typescript
import { State, Show, Cleanup } from './lib/solid';

const [active, setActive] = State(false);

Show(
  active,
  () => {
    console.log("Starting Polling...");
    const interval = setInterval(() => console.log("Ping..."), 1000);

    // This runs when 'active' becomes false
    Cleanup(() => {
      console.log("Stopping Polling...");
      clearInterval(interval);
    });
  }
);

setActive(true);  // Starts pinging
// ... wait ...
setActive(false); // Logs "Stopping Polling..." and clears interval
```

---

## Complex Integration Example

This example simulates a **Task Processing System** logic entirely without a UI. It demonstrates `For`, `Show`, `Effect`, and `State` working together.

```typescript
import { State, Effect, Show, For, Cleanup, Global } from './lib/solid';
import { createRoot } from 'solid-js';

// Setup a root to manage disposal
createRoot((dispose) => {

  type Task = { id: number; name: string; priority: 'high' | 'low' };

  // 1. Global Configuration
  const [systemStatus, setSystemStatus] = Global('system_status', 'IDLE');

  // 2. Local State
  const [tasks, setTasks] = State<Task[]>([]);
  const [processedCount, setProcessedCount] = State(0);

  console.log("--- System Initialized ---");

  // 3. React to System Status
  Effect(() => {
    console.log(`[STATUS CHANGE] System is now: ${systemStatus()}`);
  });

  // 4. Main Processing Logic
  // Only process tasks when system is RUNNING
  Show(
    () => systemStatus() === 'RUNNING',
    () => {
      console.log("[LOGIC] Processing Engine Started");

      // Iterate over tasks roughly
      For(tasks, (task, index) => {
        
        // Per-task logic scope
        Effect(() => {
          console.log(`[TASK] Monitor: Task #${task.id} "${task.name}" is in queue at pos ${index()}`);
        });

        // Handle specific priority
        Show(
          () => task.priority === 'high',
          () => console.log(`  -> [ALERT] High priority task detected: ${task.name}`)
        );

        // Cleanup if task is removed from list or system stops
        Cleanup(() => {
          console.log(`[TASK] Cleanup: Task #${task.id} removed or processing stopped.`);
          setProcessedCount(p => p + 1);
        });
      });

      // Cleanup for the generic engine
      Cleanup(() => console.log("[LOGIC] Processing Engine Halted"));
    },
    // Fallback when not RUNNING
    () => {
      console.log("[LOGIC] System is paused. Waiting for command.");
    }
  );

  // --- Simulation ---

  // Start System
  setSystemStatus('RUNNING');

  // Add Tasks
  setTasks([
    { id: 1, name: 'Database Backup', priority: 'low' },
    { id: 2, name: 'Critical Security Patch', priority: 'high' }
  ]);

  // Modify List (swap)
  console.log("--- Reordering Tasks ---");
  setTasks((prev) => [prev[1], prev[0]]); 

  // Remove a task
  console.log("--- Completing Task #2 ---");
  setTasks((prev) => prev.filter(t => t.id !== 2));

  // Stop System
  console.log("--- Stopping System ---");
  setSystemStatus('STOPPED');
  
  // Check stats
  console.log(`Total processed/removed iterations: ${processedCount()}`);

  dispose(); // Clean up everything
});
```
