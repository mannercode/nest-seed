import { NestFactory } from '@nestjs/core'
import { AppConfigService, configureApp } from 'shared'
import { CoresModule } from './cores.module'

export async function bootstrap() {
    const app = await NestFactory.create(CoresModule)
    const config = app.get(AppConfigService)

    await configureApp({
        app,
        directories: [config.log.directory],
        natOptions: { servers: config.nats.servers, queue: 'apps/cores' },
        http: config.http
    })

    console.log(`Cores is running on: ${await app.getUrl()}`)
}
