import { INestApplication } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { MicroserviceOptions, Transport } from '@nestjs/microservices'
import { AppLoggerService, HttpToRpcExceptionFilter, Path } from 'common'
import { exit } from 'process'
import { AppConfigService } from 'shared/config'
import { CoresModule } from './cores.module'

export async function configureCores(app: INestApplication<any>, servers: string[]) {
    const config = app.get(AppConfigService)

    for (const directory of [config.log.directory]) {
        if (!(await Path.isWritable(directory))) {
            console.error(`Error: Directory is not writable: '${directory}'`)
            exit(1)
        }
    }

    app.useGlobalFilters(new HttpToRpcExceptionFilter())

    app.connectMicroservice<MicroserviceOptions>(
        { transport: Transport.NATS, options: { servers, queue: 'cores' } },
        { inheritAppConfig: true }
    )

    await app.startAllMicroservices()

    const logger = app.get(AppLoggerService)
    app.useLogger(logger)
}

export async function bootstrap() {
    const app = await NestFactory.create(CoresModule)

    const config = app.get(AppConfigService)

    const { servers } = config.nats
    configureCores(app, servers)

    app.enableShutdownHooks()

    const { httpPort } = config.services.cores
    await app.listen(httpPort)

    console.log(`Cores is running: ${await app.getUrl()}`)
}
