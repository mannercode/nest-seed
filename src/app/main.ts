import { INestApplication } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { AppLoggerService } from 'common'
import * as compression from 'compression'
import { AppConfigService, isEnv } from 'config'
import * as express from 'express'
import { existsSync } from 'fs'
import { exit } from 'process'
import { AppModule } from './app.module'

// TODO 테스트에 이것도 설정해야 하지 않나?
export function setupApp(app: INestApplication<any>) {
    app.use(compression())

    const logger = app.get(AppLoggerService)
    app.useLogger(logger)

    const config = app.get(AppConfigService)
    const limit = config.http.requestPayloadLimit
    app.use(express.json({ limit }))
    app.use(express.urlencoded({ limit, extended: true }))

    if (!existsSync(config.fileUpload.directory)) {
        console.log(`File upload directory does not exist: ${config.fileUpload.directory}`)
        exit(1)
    }

    if (!existsSync(config.log.directory)) {
        console.log(`Log directory does not exist: ${config.log.directory}`)
        exit(1)
    }
}

async function bootstrap() {
    const app = await NestFactory.create(AppModule)
    setupApp(app)

    await app.listen(3000)

    console.log(`Application is running on: ${await app.getUrl()}`)
}

if (isEnv('development') || isEnv('production')) {
    bootstrap()
} else {
    console.error('NODE_ENV is not set. Exiting...')
    process.exit(1)
}
