import { INestApplication } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { MicroserviceOptions, Transport } from '@nestjs/microservices'
import { AppLoggerService, generateShortId, HttpToRpcExceptionFilter } from 'common'
import { existsSync } from 'fs'
import { exit } from 'process'
import { AppConfigService, isTest } from 'shared/config'
import { InfrastructuresModule } from './infrastructures.module'
import { Partitioners } from 'kafkajs'

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
    const brokers = config.brokers
    const healthPort = config.services.infrastructures.healthPort
    const groupId = isTest() ? 'test_' + generateShortId() : 'infrastructures'
    const clientId = groupId

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
                maxWaitTimeInMs: 500
            }
        }
    })

    await app.startAllMicroservices()
    await app.listen(healthPort)

    console.log(`Infrastructures is running: ${await app.getUrl()}`)
}
