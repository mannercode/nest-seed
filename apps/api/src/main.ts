import { bootstrap } from './bootstrap.js'

bootstrap().catch((err: unknown) => {
    console.error(err)
    process.exit(1)
})
