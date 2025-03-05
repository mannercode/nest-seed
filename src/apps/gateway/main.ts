import { INestApplication } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { MicroserviceOptions, Transport } from '@nestjs/microservices'
import { AppLoggerService, Path } from 'common'
import compression from 'compression'
import express from 'express'
import { exit } from 'process'
import { AppConfigService } from 'shared/config'
import { GatewayModule } from './gateway.module'

export async function configureGateway(app: INestApplication<any>, servers: string[]) {
    const config = app.get(AppConfigService)

    for (const directory of [config.fileUpload.directory, config.log.directory]) {
        if (!(await Path.isWritable(directory))) {
            console.error(`Error: Directory is not writable: '${directory}'`)
            exit(1)
        }
    }

    app.use(compression())

    const limit = config.http.requestPayloadLimit
    app.use(express.json({ limit }))
    app.use(express.urlencoded({ limit, extended: true }))

    app.connectMicroservice<MicroserviceOptions>(
        { transport: Transport.NATS, options: { servers, queue: 'gateway' } },
        { inheritAppConfig: true }
    )

    await app.startAllMicroservices()

    const logger = app.get(AppLoggerService)
    app.useLogger(logger)
}

export async function bootstrap() {
    const app = await NestFactory.create(GatewayModule)

    const config = app.get(AppConfigService)

    const { servers } = config.nats
    configureGateway(app, servers)

    app.enableShutdownHooks()

    const { httpPort } = config.services.gateway
    await app.listen(httpPort)

    console.log(`Gateway is running on: ${await app.getUrl()}`)
}
