import { INestApplication } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { MicroserviceOptions, Transport } from '@nestjs/microservices'
import { AppLoggerService, RpcExceptionFilter, Path } from 'common'
import { exit } from 'process'
import { AppConfigService } from 'shared/config'
import { InfrastructuresModule } from './infrastructures.module'

export async function configureInfrastructures(app: INestApplication<any>, servers: string[]) {
    const config = app.get(AppConfigService)

    for (const directory of [config.fileUpload.directory, config.log.directory]) {
        if (!(await Path.isWritable(directory))) {
            console.error(`Error: Directory is not writable: '${directory}'`)
            exit(1)
        }
    }

    app.useGlobalFilters(new RpcExceptionFilter())

    app.connectMicroservice<MicroserviceOptions>(
        { transport: Transport.NATS, options: { servers, queue: 'infrastructures' } },
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
