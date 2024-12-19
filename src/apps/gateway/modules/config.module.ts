import { Global, Module } from '@nestjs/common'
import { ConfigModule as NestConfigModule } from '@nestjs/config'
import { GatewayConfigService, configSchema } from 'gateway/config'

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
    providers: [GatewayConfigService],
    exports: [GatewayConfigService]
})
export class ConfigModule {}
