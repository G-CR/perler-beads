import { buildApp } from './app.ts'

let app: Awaited<ReturnType<typeof buildApp>> | undefined
try {
  app = await buildApp()
  await app.listen({ host: app.env.host, port: app.env.port })
} catch (error) {
  if (app) {
    app.log.error(error)
  } else {
    console.error(error)
  }
  process.exitCode = 1
  if (app) {
    await app.close()
  }
}
