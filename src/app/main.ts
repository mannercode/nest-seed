import { NestFactory } from '@nestjs/core'
import { isEnv } from 'config'
import { AppModule, configureApp } from './app.module'

async function bootstrap() {
    const app = await NestFactory.create(AppModule)
    configureApp(app)

    await app.listen(3000)

    console.log(`Application is running on: ${await app.getUrl()}`)
}

if (isEnv('production')) {
    bootstrap()
} else {
    console.error('NODE_ENV is not set. Exiting...')
    process.exit(1)
}
