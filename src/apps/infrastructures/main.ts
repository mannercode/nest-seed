import { NestFactory } from '@nestjs/core'
import { AppConfigService, configureApp } from 'shared'
import { InfrastructuresModule } from './infrastructures.module'

export async function bootstrap() {
    const app = await NestFactory.create(InfrastructuresModule)
    const config = app.get(AppConfigService)

    await configureApp({
        app,
        directories: [config.log.directory],
        natOptions: { servers: config.nats.servers, queue: 'apps/infrastructures' },
        http: config.http
    })

    console.log(`Infrastructures is running on: ${await app.getUrl()}`)
}
