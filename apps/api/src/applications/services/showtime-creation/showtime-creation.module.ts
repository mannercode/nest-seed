import { CacheModule, NatsPubSubModule, TemporalWorkerService } from '@mannercode/common'
import { Module } from '@nestjs/common'
import { AppConfigService, getProjectId, NatsConfigModule, RedisConfigModule } from 'config'
import { MoviesModule, ShowtimesModule, TheatersModule, TicketsModule } from 'cores'
import {
    ShowtimeBulkCreatorService,
    ShowtimeBulkValidatorService,
    ShowtimeCreationOrchestratorService
} from './services'
import { ShowtimeCreationEvents } from './showtime-creation.events'
import { ShowtimeCreationService } from './showtime-creation.service'
import { ShowtimeCreationActivities } from './temporal/activities'
import { getShowtimeCreationTaskQueue } from './temporal/types'

@Module({
    exports: [ShowtimeCreationService, ShowtimeCreationEvents],
    imports: [
        NatsPubSubModule.register({ natsName: NatsConfigModule.connectionName }),
        CacheModule.register({
            name: 'showtime-creation',
            prefix: `cache:${getProjectId()}`,
            redisName: RedisConfigModule.connectionName
        }),
        MoviesModule,
        TheatersModule,
        ShowtimesModule,
        TicketsModule
    ],
    providers: [
        ShowtimeCreationEvents,
        ShowtimeCreationService,
        ShowtimeCreationOrchestratorService,
        ShowtimeBulkValidatorService,
        ShowtimeBulkCreatorService,
        ShowtimeCreationActivities,
        {
            inject: [AppConfigService, ShowtimeCreationActivities],
            provide: TemporalWorkerService,
            useFactory: (config: AppConfigService, activities: ShowtimeCreationActivities) =>
                new TemporalWorkerService({
                    activities: activities.bind(),
                    address: config.temporal.address,
                    namespace: config.temporal.namespace,
                    taskQueue: getShowtimeCreationTaskQueue(),
                    workflowsPath: require.resolve('./temporal/workflows')
                })
        }
    ]
})
export class ShowtimeCreationModule {}
