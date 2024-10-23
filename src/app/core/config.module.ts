import { Global, Module } from '@nestjs/common'
import { ConfigModule as NestConfigModule } from '@nestjs/config'
import { AppConfigService, configSchema, isEnv } from 'config'

@Global()
@Module({
    imports: [
        NestConfigModule.forRoot({
            cache: isEnv('production'),
            ignoreEnvFile: isEnv('production'),
            envFilePath: '.env.development',
            validationSchema: configSchema,
            validationOptions: { abortEarly: false }
        })
    ],
    providers: [AppConfigService],
    exports: [AppConfigService]
})
export class ConfigModule {}
