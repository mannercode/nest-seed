import { INestApplication } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { AppLoggerService } from 'common'
import * as compression from 'compression'
import { AppConfigService, isEnv } from 'config'
import * as express from 'express'
import { existsSync } from 'fs'
import { exit } from 'process'
import { AppModule } from './app.module'

export function setupApp(app: INestApplication<any>) {
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

async function bootstrap() {
    const app = await NestFactory.create(AppModule)
    setupApp(app)

    await app.listen(3000)

    console.log(`Application is running on: ${await app.getUrl()}`)
}

if (isEnv('production')) {
    bootstrap()
} else {
    console.error('NODE_ENV is not set. Exiting...')
    process.exit(1)
}
