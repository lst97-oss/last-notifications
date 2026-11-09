export {}

// `bun run dev` runs the app and the channel worker in one terminal. When either exits, the other is
// stopped too, so a crashed worker never sits unnoticed behind a running app.
// Vite clears the terminal at startup and on repeated messages, which erases the worker's lines here, so it is turned off.
// The dev server answers requests in a worker thread, which never reports a terminal, so the format and colour are
// set here. A value already in the environment wins.
const logEnv = {
  ...process.env,
  LOG_FORMAT: process.env.LOG_FORMAT ?? 'pretty',
  LOG_COLOR: process.env.LOG_COLOR ?? 'always',
}
const children = [
  Bun.spawn(['bunx', '--bun', 'vite', 'dev', '--port', '3002', '--clearScreen', 'false'], {
    env: logEnv,
    stdio: ['inherit', 'inherit', 'inherit'],
  }),
  Bun.spawn(['bun', '--bun', 'scripts/channel-worker.ts'], { env: logEnv, stdio: ['inherit', 'inherit', 'inherit'] }),
]

function stopAll(signal: NodeJS.Signals): void {
  for (const child of children) child.kill(signal)
}
process.on('SIGINT', () => stopAll('SIGINT'))
process.on('SIGTERM', () => stopAll('SIGTERM'))

const code = await Promise.race(children.map((child) => child.exited.then(() => child.exitCode ?? 0)))
stopAll('SIGTERM')
await Promise.all(children.map((child) => child.exited))
process.exit(code)
