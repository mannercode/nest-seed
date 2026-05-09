import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { bootstrapApp } from './bootstrap-app'

export async function bootstrap() {
    const app = await NestFactory.create(AppModule)

    await bootstrapApp({ app })

    console.log(`Application is running on: ${await app.getUrl()}`)
}
