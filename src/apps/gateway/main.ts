import { NestFactory } from '@nestjs/core'
import { AppConfigService, configureApp } from 'shared'
import { GatewayModule } from './gateway.module'

export async function bootstrap() {
    const app = await NestFactory.create(GatewayModule)
    const config = app.get(AppConfigService)

    await configureApp({
        app,
        directories: [config.fileUpload.directory, config.log.directory],
        natOptions: { servers: config.nats.servers, queue: 'apps/gateway' },
        http: config.http
    })

    console.log(`Gateway is running on: ${await app.getUrl()}`)
}
