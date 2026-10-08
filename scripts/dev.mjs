// VS Code's terminal sets ELECTRON_RUN_AS_NODE=1, which makes Electron start as plain Node.
// Clear it before starting electron-vite so `npm run dev` works from any terminal.
import { spawn } from 'child_process'

delete process.env.ELECTRON_RUN_AS_NODE
const child = spawn('npx', ['electron-vite', ...process.argv.slice(2)], { stdio: 'inherit', shell: true })
child.on('exit', (code) => process.exit(code ?? 0))
