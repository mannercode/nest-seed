import { bootstrap } from './bootstrap'

bootstrap().catch((err: unknown) => {
    console.error(err)
    process.exit(1)
})
