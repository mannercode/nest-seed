import { NestFactory } from '@nestjs/core'
import { AppConfigService, configureApp } from 'shared'
import { InfrastructuresModule } from './infrastructures.module'

export async function bootstrap() {
    const app = await NestFactory.create(InfrastructuresModule)
    const { http, nats } = app.get(AppConfigService)
    const natOptions = { servers: nats.servers, queue: 'apps/infrastructures' }

    await configureApp({ app, natOptions, http })

    console.log(`Infrastructures is running on: ${await app.getUrl()}`)
}
