import { NestFactory } from '@nestjs/core'
import { configureApp } from 'shared'
import { ApplicationsModule } from './applications.module'

export async function bootstrap() {
    const app = await NestFactory.create(ApplicationsModule)
    const natOptions = { queue: 'apps/applications' }

    await configureApp({ app, natOptions })

    console.log(`Applications is running: ${await app.getUrl()}`)
}
