import { INestApplication } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { MicroserviceOptions, Transport } from '@nestjs/microservices'
import { AppLoggerService, HttpToRpcExceptionFilter } from 'common'
import { existsSync } from 'fs'
import { exit } from 'process'
import { AppConfigService } from 'shared/config'
import { InfrastructuresModule } from './infrastructures.module'

export async function configureInfrastructures(app: INestApplication<any>, servers: string[]) {
    const config = app.get(AppConfigService)

    for (const dir of [
        { name: 'FileUpload', path: config.fileUpload.directory },
        { name: 'Log', path: config.log.directory }
    ]) {
        if (!existsSync(dir.path)) {
            console.error(`${dir.name} directory does not exist: ${dir.path}`)
            exit(1)
        }
    }

    app.useGlobalFilters(new HttpToRpcExceptionFilter())

    app.connectMicroservice<MicroserviceOptions>(
        { transport: Transport.NATS, options: { servers } },
        { inheritAppConfig: true }
    )

    await app.startAllMicroservices()

    const logger = app.get(AppLoggerService)
    app.useLogger(logger)
}

export async function bootstrap() {
    const app = await NestFactory.create(InfrastructuresModule)

    const config = app.get(AppConfigService)

    const { servers } = config.nats
    configureInfrastructures(app, servers)

    app.enableShutdownHooks()

    const { httpPort } = config.services.infrastructures
    await app.listen(httpPort)

    console.log(`Infrastructures is running: ${await app.getUrl()}`)
}
