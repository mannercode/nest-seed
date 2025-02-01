import { INestApplication } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { MicroserviceOptions, Transport } from '@nestjs/microservices'
import { AppLoggerService, generateShortId, HttpToRpcExceptionFilter } from 'common'
import { existsSync } from 'fs'
import { Partitioners } from 'kafkajs'
import { exit } from 'process'
import { AppConfigService, isTest } from 'shared/config'
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
    const app = await NestFactory.create(CoresModule)

    configureCores(app)

    app.enableShutdownHooks()

    const config = app.get(AppConfigService)
    const healthPort = config.services.cores.healthPort
    const brokers = config.brokers
    const groupId = isTest() ? 'test_' + generateShortId() : 'cores'
    const clientId = 'cores'

    app.connectMicroservice<MicroserviceOptions>({
        transport: Transport.KAFKA,
        options: {
            client: { brokers, clientId },
            producer: {
                allowAutoTopicCreation: false,
                createPartitioner: Partitioners.DefaultPartitioner
            },
            consumer: {
                groupId,
                allowAutoTopicCreation: false,
                maxWaitTimeInMs: 0
            }
        }
    })

    await app.startAllMicroservices()
    await app.listen(healthPort)

    console.log(`Cores is running: ${await app.getUrl()}`)
}
