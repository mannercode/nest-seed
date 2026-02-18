import { NestFactory } from '@nestjs/core'
import { configureApp } from 'shared'
import { GatewayModule } from './gateway.module'

export async function bootstrap() {
    const app = await NestFactory.create(GatewayModule)
    const natsOptions = { queue: 'apps/gateway' }

    await configureApp({ app, natsOptions })

    console.log(`Gateway is running on: ${await app.getUrl()}`)
}
