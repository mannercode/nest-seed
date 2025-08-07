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
        httpPort: config.services.applications.httpPort,
        requestPayloadLimit: config.http.requestPayloadLimit
    })

    console.log(`Applications is running: ${await app.getUrl()}`)
}
