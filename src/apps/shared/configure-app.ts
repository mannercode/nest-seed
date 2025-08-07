import { INestApplication } from '@nestjs/common'
import { MicroserviceOptions, Transport } from '@nestjs/microservices'
import { AppLoggerService, Path } from 'common'
import compression from 'compression'
import express from 'express'
import { exit } from 'process'

export async function configureApp({
    app,
    directories,
    natOptions,
    httpPort,
    requestPayloadLimit
}: {
    app: INestApplication<any>
    directories: string[]
    natOptions: { servers: string[]; queue: string }
    httpPort: number
    requestPayloadLimit: string
}) {
    for (const directory of directories) {
        if (!(await Path.isWritable(directory))) {
            console.error(`Error: Directory is not writable: '${directory}'`)
            exit(1)
        }
    }

    app.use(compression())

    app.use(express.json({ limit: requestPayloadLimit }))

    app.connectMicroservice<MicroserviceOptions>(
        { transport: Transport.NATS, options: natOptions },
        { inheritAppConfig: true }
    )

    await app.startAllMicroservices()

    const logger = app.get(AppLoggerService)
    app.useLogger(logger)

    app.enableShutdownHooks()

    await app.listen(httpPort)
}
