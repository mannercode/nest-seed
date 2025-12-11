import { NestFactory } from '@nestjs/core'
import { configureApp } from 'shared'
import { InfrastructuresModule } from './infrastructures.module'

export async function bootstrap() {
    const app = await NestFactory.create(InfrastructuresModule)
    const natOptions = { queue: 'apps/infrastructures' }

    await configureApp({ app, natOptions })

    console.log(`Infrastructures is running on: ${await app.getUrl()}`)
}
