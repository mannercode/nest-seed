import type { INestApplication } from '@nestjs/common'
import type { MicroserviceOptions } from '@nestjs/microservices'
import { Transport } from '@nestjs/microservices'
import { AppLoggerService, Path } from 'common'
import compression from 'compression'
import express from 'express'
import { exit } from 'process'
import { AppConfigService } from './config/app-config.service'

type ConfigureAppOptions = { app: INestApplication<any>; natsOptions: { queue: string } }

export async function configureApp({ app, natsOptions }: ConfigureAppOptions) {
    const { http, log, nats } = app.get(AppConfigService)

    await Path.mkdir(log.directory)

    if (!(await Path.isWritable(log.directory))) {
        console.error(`Error: Directory is not writable: '${log.directory}'`)
        exit(1)
    }

    app.use(compression())
    app.use(express.json({ limit: http.requestPayloadLimit }))

    app.connectMicroservice<MicroserviceOptions>(
        { options: { servers: nats.servers, ...natsOptions }, transport: Transport.NATS },
        { inheritAppConfig: true }
    )

    await app.startAllMicroservices()

    const logger = app.get(AppLoggerService)
    app.useLogger(logger)

    app.enableShutdownHooks()

    await app.listen(http.port)
}
