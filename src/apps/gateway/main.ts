import { NestFactory } from '@nestjs/core'
import { AppConfigService, configureApp } from 'shared'
import { GatewayModule } from './gateway.module'

export async function bootstrap() {
    const app = await NestFactory.create(GatewayModule)
    const { http, nats } = app.get(AppConfigService)
    const natOptions = { servers: nats.servers, queue: 'apps/gateway' }

    await configureApp({ app, natOptions, http })

    console.log(`Gateway is running on: ${await app.getUrl()}`)
}
