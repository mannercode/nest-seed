import { NestFactory } from '@nestjs/core'
import { AppConfigService, configureApp } from 'shared'
import { ApplicationsModule } from './applications.module'

export async function bootstrap() {
    const app = await NestFactory.create(ApplicationsModule)
    const config = app.get(AppConfigService)

    await configureApp({
        app,
        directories: [config.log.directory],
        natOptions: { servers: config.nats.servers, queue: 'apps/applications' },
        http: config.http
    })

    console.log(`Applications is running: ${await app.getUrl()}`)
}
