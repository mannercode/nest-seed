import { NestFactory } from '@nestjs/core'
import { AppConfigService, configureApp } from 'shared'
import { CoresModule } from './cores.module'

export async function bootstrap() {
    const app = await NestFactory.create(CoresModule)
    const { http, nats } = app.get(AppConfigService)
    const natOptions = { servers: nats.servers, queue: 'apps/cores' }

    await configureApp({ app, natOptions, http })

    console.log(`Cores is running on: ${await app.getUrl()}`)
}
