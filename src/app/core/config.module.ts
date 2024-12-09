import { Global, Module } from '@nestjs/common'
import { ConfigModule as NestConfigModule } from '@nestjs/config'
import { AppConfigService, configSchema } from 'config'

@Global()
@Module({
    imports: [
        NestConfigModule.forRoot({
            cache: true,
            ignoreEnvFile: true,
            validationSchema: configSchema,
            validationOptions: { abortEarly: false }
        })
    ],
    providers: [AppConfigService],
    exports: [AppConfigService]
})
export class ConfigModule {}
