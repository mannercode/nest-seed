import type { INestApplication } from '@nestjs/common'
import { AppLoggerService, Path } from '@mannercode/common'
import compression from 'compression'
import express from 'express'
import { exit } from 'process'
import { AppConfigService } from './config/app-config.service'

type ConfigureAppOptions = { app: INestApplication<any> }

export async function configureApp({ app }: ConfigureAppOptions) {
    const { http, log } = app.get(AppConfigService)

    await Path.mkdir(log.directory)

    if (!(await Path.isWritable(log.directory))) {
        console.error(`Error: Directory is not writable: '${log.directory}'`)
        exit(1)
    }

    app.use(compression())
    app.use(express.json({ limit: http.requestPayloadLimit }))

    const logger = app.get(AppLoggerService)
    app.useLogger(logger)

    app.enableShutdownHooks()

    await app.listen(http.port)
}
