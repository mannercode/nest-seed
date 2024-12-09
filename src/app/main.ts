import { INestApplication } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { AppLoggerService } from 'common'
import compression from 'compression'
import { AppConfigService } from 'config'
import express from 'express'
import { existsSync } from 'fs'
import { exit } from 'process'
import { AppModule } from './app.module'

export function configureApp(app: INestApplication<any>) {
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
    const app = await NestFactory.create(AppModule)
    configureApp(app)

    // for Kubernetes to manage containers' lifecycles
    app.enableShutdownHooks()

    await app.listen(3000)

    console.log(`Application is running on: ${await app.getUrl()}`)
}
