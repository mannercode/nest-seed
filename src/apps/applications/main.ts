import { NestFactory } from '@nestjs/core'
import { AppConfigService, configureApp } from 'shared'
import { ApplicationsModule } from './applications.module'

export async function bootstrap() {
    const app = await NestFactory.create(ApplicationsModule)
    const { http, nats } = app.get(AppConfigService)
    const natOptions = { servers: nats.servers, queue: 'apps/applications' }

    await configureApp({ app, natOptions, http })

    console.log(`Applications is running: ${await app.getUrl()}`)
}
