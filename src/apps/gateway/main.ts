import { NestFactory } from '@nestjs/core'
import { AppConfigService, configureApp } from 'shared'
import { GatewayModule } from './gateway.module'

export async function bootstrap() {
    const app = await NestFactory.create(GatewayModule)
    const natOptions = { queue: 'apps/gateway' }

    await configureApp({ app, natOptions })

    console.log(`Gateway is running on: ${await app.getUrl()}`)
}
