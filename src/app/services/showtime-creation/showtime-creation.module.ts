import { BullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'
import { generateUUID, ServerSentEventsService } from 'common'
import { AppConfigService, isEnv } from 'config'
import Redis from 'ioredis'
import { MoviesModule } from 'services/movies'
import { ShowtimesModule } from 'services/showtimes'
import { TheatersModule } from 'services/theaters'
import { TicketsModule } from 'services/tickets'
import {
    ShowtimeCreationEventsService,
    ShowtimeCreationValidatorService,
    ShowtimeCreationWorkerService
} from './services'
import { ShowtimeCreationService } from './showtime-creation.service'

@Module({
    imports: [
        MoviesModule,
        TheatersModule,
        ShowtimesModule,
        TicketsModule,
        BullModule.forRootAsync({
            useFactory: async (config: AppConfigService) => ({
                prefix: isEnv('test') ? `queue:{${generateUUID()}}` : '{queue}',
                connection: new Redis.Cluster(config.redis.nodes, { redisOptions: config.redis })
            }),
            inject: [AppConfigService]
        }),
        BullModule.registerQueue({ name: 'showtime-creation' })
    ],
    providers: [
        ShowtimeCreationService,
        ServerSentEventsService,
        ShowtimeCreationEventsService,
        ShowtimeCreationWorkerService,
        ShowtimeCreationValidatorService
    ],
    exports: [ShowtimeCreationService]
})
export class ShowtimeCreationModule {}
