import { CacheModule, NatsPubSubModule, TemporalWorkerService } from '@mannercode/common'
import { Module } from '@nestjs/common'
import { MoviesModule, ShowtimesModule, TheatersModule, TicketsModule } from 'core'
import path from 'path'
import { AppConfigService, getProjectId, NatsConfigModule, RedisConfigModule } from 'shared'
import {
    ShowtimeBulkCreatorService,
    ShowtimeBulkValidatorService,
    ShowtimeCreationOrchestratorService
} from './internal'
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
        // TemporalWorkerService 는 같은 module 의 provider 로 둔다. 그래야 DI
        // factory 가 같은 module 의 ShowtimeCreationActivities 를 inject 할 수 있다.
        // TemporalWorkerModule.forRootAsync 로 감싸면 factory 가 child module 에
        // 들어가 이 module 의 provider 들을 못 본다.
        {
            inject: [AppConfigService, ShowtimeCreationActivities],
            provide: TemporalWorkerService,
            useFactory: (config: AppConfigService, activities: ShowtimeCreationActivities) =>
                new TemporalWorkerService({
                    activities: activities.bind(),
                    address: config.temporal.address,
                    namespace: config.temporal.namespace,
                    taskQueue: getShowtimeCreationTaskQueue(),
                    // Prod: scripts/bundle-workflows.js 가 만들어내는 pre-bundle
                    // 의 경로 (dist/index.js 옆에 위치).
                    // Dev/test: 파일이 없으므로 service 가 workflowsPath 로
                    // fallback 해서 즉석에서 bundling 한다.
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
