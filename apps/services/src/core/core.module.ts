import { BullModule } from '@nestjs/bullmq'
import { BadRequestException, Module, ValidationPipe } from '@nestjs/common'
import { APP_PIPE } from '@nestjs/core'
import { generateShortId, RedisModule } from 'common'
import { AppConfigService, isTest, RedisConfig } from 'config'
import Redis from 'ioredis'
import { ConfigModule } from './config.module'
import { LoggerModule } from './logger.module'
import { MongooseModule } from './mongoose.module'

@Module({
    imports: [
        ConfigModule,
        LoggerModule,
        MongooseModule,
        RedisModule.forRootAsync(
            { useFactory: (config: AppConfigService) => config.redis, inject: [AppConfigService] },
            RedisConfig.connName
        ),
        BullModule.forRootAsync('queue', {
            useFactory: async (redis: Redis) => ({
                prefix: isTest() ? `{queue:${generateShortId()}}` : '{queue}',
                connection: redis
            }),
            inject: [RedisModule.getToken(RedisConfig.connName)]
        })
    ],
    providers: [
        {
            provide: APP_PIPE,
            useFactory: () =>
                new ValidationPipe({
                    exceptionFactory: (errors) =>
                        new BadRequestException({
                            code: 'ERR_VALIDATION_FAILED',
                            message: 'Validation failed',
                            details: errors.map((error) => ({
                                field: error.property,
                                constraints: error.constraints
                            }))
                        }),
                    enableDebugMessages: false, // Changing it to true doesn't make any difference.
                    disableErrorMessages: false,
                    whitelist: true, // Properties without decorators will be removed.
                    forbidNonWhitelisted: true,
                    skipMissingProperties: false, // If set to true, the validator will skip validation of all properties that are null or undefined in the validation object.
                    forbidUnknownValues: true, // Default value, any attempt to validate an unknown object will fail immediately.
                    transform: true,
                    transformOptions: {
                        enableImplicitConversion: true // Setting it to false will cause an error in @InInt().
                    }
                })
        }
    ]
})
export class CoreModule {}
