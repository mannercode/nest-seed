import { INestApplication } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { AppLoggerService } from 'common'
import compression from 'compression'
import express from 'express'
import { existsSync } from 'fs'
import { exit } from 'process'
import { GatewayModule } from './gateway.module'
import { AppConfigService } from 'shared/config'

export async function configureGateway(app: INestApplication<any>) {
    app.use(compression())

    const logger = app.get(AppLoggerService)
    app.useLogger(logger)

    const config = app.get(AppConfigService)
    const limit = config.http.requestPayloadLimit
    app.use(express.json({ limit }))
    app.use(express.urlencoded({ limit, extended: true }))

    for (const dir of [
        { name: 'FileUpload', path: config.fileUpload.directory },
        { name: 'Log', path: config.log.directory }
    ]) {
        if (!existsSync(dir.path)) {
            console.error(`${dir.name} directory does not exist: ${dir.path}`)
            exit(1)
        }
    }
}

export async function bootstrap() {
    const app = await NestFactory.create(GatewayModule)
    configureGateway(app)

    app.enableShutdownHooks()

    const config = app.get(AppConfigService)
    const { port } = config.services.gateway

    await app.listen(port)

    console.log(`Application is running on: ${await app.getUrl()}`)
}
