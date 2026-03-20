import { NestFactory } from '@nestjs/core'
import { configureApp } from 'app-common'
import { CoresModule } from './cores.module'

export async function bootstrap() {
    const app = await NestFactory.create(CoresModule)
    const natsOptions = { queue: 'apps/cores' }

    await configureApp({ app, natsOptions })

    console.log(`Cores is running on: ${await app.getUrl()}`)
}
