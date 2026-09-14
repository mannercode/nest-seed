import { Module, type DynamicModule, type Provider } from '@nestjs/common'
import { MongoConnection, type MongoConnectionOptions } from './mongo-connection.js'

@Module({})
export class MongoModule {
    static forRootAsync(options: {
        inject: any[]
        useFactory: (...args: any[]) => MongoConnectionOptions | Promise<MongoConnectionOptions>
    }): DynamicModule {
        const provider: Provider = {
            inject: options.inject,
            provide: MongoConnection,
            useFactory: async (...args: any[]) =>
                MongoConnection.connect(await options.useFactory(...args))
        }
        return { exports: [provider], global: true, module: MongoModule, providers: [provider] }
    }
}
