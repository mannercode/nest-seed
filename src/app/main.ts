import { NestFactory } from '@nestjs/core'
import { isEnv } from 'config'
import { AppModule, configureApp } from './app.module'

async function bootstrap() {
    const app = await NestFactory.create(AppModule)
    configureApp(app)

    // for Kubernetes to manage containers' lifecycles
    app.enableShutdownHooks()

    await app.listen(3000)

    console.log(`Application is running on: ${await app.getUrl()}`)
}

if (isEnv('production')) {
    bootstrap()
} else {
    console.error(
        `NODE_ENV(${process.env.NODE_ENV}) is not set to production. Exiting application...`
    )
    process.exit(1)
}
