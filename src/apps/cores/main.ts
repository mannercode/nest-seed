import { NestFactory } from '@nestjs/core'
import { AppConfigService, configureApp } from 'shared'
import { CoresModule } from './cores.module'

export async function bootstrap() {
    const app = await NestFactory.create(CoresModule)
    const natOptions = { queue: 'apps/cores' }

    await configureApp({ app, natOptions })

    console.log(`Cores is running on: ${await app.getUrl()}`)
}
