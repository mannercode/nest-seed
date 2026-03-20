import { NestFactory } from '@nestjs/core'
import { configureApp } from 'app-common'
import { ApplicationsModule } from './applications.module'

export async function bootstrap() {
    const app = await NestFactory.create(ApplicationsModule)
    const natsOptions = { queue: 'apps/applications' }

    await configureApp({ app, natsOptions })

    console.log(`Applications is running: ${await app.getUrl()}`)
}
