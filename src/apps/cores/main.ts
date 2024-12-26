import { INestApplication } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { MicroserviceOptions, Transport } from '@nestjs/microservices'
import { AppLoggerService, HttpToRpcExceptionFilter } from 'common'
import { existsSync } from 'fs'
import { exit } from 'process'
import { AppConfigService } from 'shared/config'
import { CoresModule } from './cores.module'

export async function configureCores(app: INestApplication<any>) {
    const logger = app.get(AppLoggerService)
    app.useLogger(logger)
    app.useGlobalFilters(new HttpToRpcExceptionFilter())

    const config = app.get(AppConfigService)

    for (const dir of [{ name: 'Log', path: config.log.directory }]) {
        if (!existsSync(dir.path)) {
            console.error(`${dir.name} directory does not exist: ${dir.path}`)
            exit(1)
        }
    }
}

export async function bootstrap() {
    const host = '0.0.0.0'
    const port = 3004
    const httpPort = 3005

    const app = await NestFactory.create(CoresModule)

    configureCores(app)

    app.enableShutdownHooks()

    app.connectMicroservice<MicroserviceOptions>({
        transport: Transport.TCP,
        options: { retryAttempts: 5, retryDelay: 2000, port, host }
    })

    await app.startAllMicroservices()
    await app.listen(httpPort)

    console.log(`Cores is running:
        - tcp://${host}:${port}
        - ${await app.getUrl()}`)
}
