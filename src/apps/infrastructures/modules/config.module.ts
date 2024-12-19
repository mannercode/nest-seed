import { Global, Module } from '@nestjs/common'
import { ConfigModule as NestConfigModule } from '@nestjs/config'
import { InfrastructuresConfigService, configSchema } from '../config'

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
    providers: [InfrastructuresConfigService],
    exports: [InfrastructuresConfigService]
})
export class ConfigModule {}
