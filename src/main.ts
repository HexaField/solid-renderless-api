import fs from 'node:fs'
import path from 'node:path'
import { runLogic } from '../lib/Interpreter'
import { Global } from '../lib/solid'

async function main() {
  const jsonPath = path.resolve(process.cwd(), 'demo.json')
  const json = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'))

  // Context with globals needed
  const context = {
    setInterval: setInterval,
    clearInterval: clearInterval,
    console: console,
    log: (msg: any) => console.log(msg)
  }

  console.log('--- Starting Logic Interpreter ---')

  // Initialize Global manually if needed?
  // The JSON initializes 'app_status' via $global op.

  runLogic(json, context)

  // Scheduled interaction
  setTimeout(() => {
    console.log("\n>>> [Main] Manually setting app_status to 'running'...\n")
    const [, set] = Global('app_status')
    set('running')
  }, 1000)

  // Wait for finish
  setTimeout(() => {
    // Check if finished?
    const [get] = Global('app_status')
    console.log(`\n>>> [Main] Final Status: ${get()}`)
    console.log('>>> [Main] Exiting.')
    process.exit(0)
  }, 4000)
}

main()
