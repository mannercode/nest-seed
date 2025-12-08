import { INestApplication } from '@nestjs/common'
import { MicroserviceOptions, Transport } from '@nestjs/microservices'
import { AppLoggerService } from 'common'
import compression from 'compression'
import express from 'express'

type ConfigureAppOptions = {
    app: INestApplication<any>
    natOptions: { servers: string[]; queue: string }
    http: { port: number; requestPayloadLimit: string }
}

export async function configureApp({ app, natOptions, http }: ConfigureAppOptions) {
    app.use(compression())
    app.use(express.json({ limit: http.requestPayloadLimit }))

    app.connectMicroservice<MicroserviceOptions>(
        { transport: Transport.NATS, options: natOptions },
        { inheritAppConfig: true }
    )

    await app.startAllMicroservices()

    const logger = app.get(AppLoggerService)
    app.useLogger(logger)

    app.enableShutdownHooks()

    await app.listen(http.port)
}
