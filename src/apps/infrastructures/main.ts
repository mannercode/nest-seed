import { NestFactory } from '@nestjs/core'
import { configureApp } from 'shared'
import { InfrastructuresModule } from './infrastructures.module'

export async function bootstrap() {
    const app = await NestFactory.create(InfrastructuresModule)
    const natsOptions = { queue: 'apps/infrastructures' }

    await configureApp({ app, natsOptions })

    console.log(`Infrastructures is running on: ${await app.getUrl()}`)
}
