import { INestMicroservice } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { MicroserviceOptions, Transport } from '@nestjs/microservices'
import { AppLoggerService, HttpToRpcExceptionFilter } from 'common'
import { existsSync } from 'fs'
import { exit } from 'process'
import { ApplicationsConfigService } from './config'
import { ApplicationsModule } from './applications.module'

export async function configureApplications(app: INestMicroservice) {
    const logger = app.get(AppLoggerService)
    app.useLogger(logger)
    app.useGlobalFilters(new HttpToRpcExceptionFilter())

    const config = app.get(ApplicationsConfigService)

    for (const dir of [{ name: 'Log', path: config.log.directory }]) {
        if (!existsSync(dir.path)) {
            console.error(`${dir.name} directory does not exist: ${dir.path}`)
            exit(1)
        }
    }
}

export async function bootstrap() {
    const port = 3001
    const app = await NestFactory.createMicroservice<MicroserviceOptions>(ApplicationsModule, {
        transport: Transport.TCP,
        options: { retryAttempts: 5, retryDelay: 3000, port, host: '0.0.0.0' }
    })
    configureApplications(app)

    app.enableShutdownHooks() // for Kubernetes to manage containers' lifecycles

    await app.listen()

    console.log(`Application is running on: ${port}`)
}
