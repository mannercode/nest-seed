import { NestFactory } from '@nestjs/core'
import { configureApp } from 'config'
import { AppModule } from './app.module'

export async function bootstrap() {
    const app = await NestFactory.create(AppModule)

    await configureApp({ app })

    console.log(`Application is running on: ${await app.getUrl()}`)
}
