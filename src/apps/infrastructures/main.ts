import { INestApplication } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { MicroserviceOptions, Transport } from '@nestjs/microservices'
import { AppLoggerService, HttpToRpcExceptionFilter } from 'common'
import { existsSync } from 'fs'
import { exit } from 'process'
import { AppConfigService } from 'shared/config'
import { InfrastructuresModule } from './infrastructures.module'

export async function configureInfrastructures(app: INestApplication<any>) {
    const logger = app.get(AppLoggerService)
    app.useLogger(logger)
    app.useGlobalFilters(new HttpToRpcExceptionFilter())

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
}

export async function bootstrap() {
    const app = await NestFactory.create(InfrastructuresModule)

    configureInfrastructures(app)

    app.enableShutdownHooks()

    const config = app.get(AppConfigService)
    const healthPort = config.services.infrastructures.healthPort
    const { servers } = config.nats

    app.connectMicroservice<MicroserviceOptions>({
        transport: Transport.NATS,
        options: { servers }
    })

    await app.startAllMicroservices()
    await app.listen(healthPort)

    console.log(`Infrastructures is running: ${await app.getUrl()}`)
}
