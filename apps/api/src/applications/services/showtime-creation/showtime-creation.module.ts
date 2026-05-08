import { CacheModule, NatsPubSubModule, TemporalWorkerService } from '@mannercode/common'
import { Module } from '@nestjs/common'
import { AppConfigService, getProjectId, NatsConfigModule, RedisConfigModule } from 'config'
import { MoviesModule, ShowtimesModule, TheatersModule, TicketsModule } from 'cores'
import path from 'path'
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
        // TemporalWorkerService stays as a same-module provider so its DI
        // factory can inject ShowtimeCreationActivities (also same-module).
        // Wrapping in a TemporalWorkerModule.forRootAsync would put the
        // factory into a child module that can't see this module's providers.
        {
            inject: [AppConfigService, ShowtimeCreationActivities],
            provide: TemporalWorkerService,
            useFactory: (config: AppConfigService, activities: ShowtimeCreationActivities) =>
                new TemporalWorkerService({
                    activities: activities.bind(),
                    address: config.temporal.address,
                    namespace: config.temporal.namespace,
                    taskQueue: getShowtimeCreationTaskQueue(),
                    // Prod: path of the pre-bundle produced by
                    // scripts/bundle-workflows.js (lives next to dist/index.js).
                    // Dev/tests: the file isn't there → service falls back to
                    // workflowsPath and bundles on the fly.
                    workflowBundlePath: path.join(
                        __dirname,
                        'showtime-creation-workflow-bundle.js'
                    ),
                    workflowsPath: require.resolve('./temporal/workflows')
                })
        }
    ]
})
export class ShowtimeCreationModule {}
