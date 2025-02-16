import { INestApplication } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { MicroserviceOptions, Transport } from '@nestjs/microservices'
import { AppLoggerService, HttpToRpcExceptionFilter } from 'common'
import { existsSync } from 'fs'
import { exit } from 'process'
import { AppConfigService } from 'shared/config'
import { ApplicationsModule } from './applications.module'

export async function configureApplications(app: INestApplication<any>, servers: string[]) {
    const config = app.get(AppConfigService)

    for (const dir of [{ name: 'Log', path: config.log.directory }]) {
        if (!existsSync(dir.path)) {
            console.error(`${dir.name} directory does not exist: ${dir.path}`)
            exit(1)
        }
    }

    app.useGlobalFilters(new HttpToRpcExceptionFilter())

    app.connectMicroservice<MicroserviceOptions>(
        { transport: Transport.NATS, options: { servers, queue: 'applications' } },
        { inheritAppConfig: true }
    )

    await app.startAllMicroservices()

    const logger = app.get(AppLoggerService)
    app.useLogger(logger)
}

export async function bootstrap() {
    const app = await NestFactory.create(ApplicationsModule)

    const config = app.get(AppConfigService)

    const { servers } = config.nats
    configureApplications(app, servers)

    app.enableShutdownHooks()

    const { httpPort } = config.services.applications
    await app.listen(httpPort)

    console.log(`Applications is running: ${await app.getUrl()}`)
}
