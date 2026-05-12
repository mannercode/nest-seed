import { CacheModule, NatsPubSubModule, TemporalWorkerService } from '@mannercode/common'
import { Module } from '@nestjs/common'
import { AppConfigService, getProjectId, NATS_CONNECTION_NAME, REDIS_CONNECTION_NAME } from 'config'
import { MoviesModule, ShowtimesModule, TheatersModule, TicketsModule } from 'core'
import {
    ShowtimeBulkCreatorService,
    ShowtimeBulkValidatorService,
    ShowtimeCreationOrchestratorService
} from './internal'
import { ShowtimeCreationEvents } from './showtime-creation.events'
import { ShowtimeCreationService } from './showtime-creation.service'
import { ShowtimeCreationActivities } from './worker/activities'
import { showtimeCreationBundle } from './worker/bundle'
import { getShowtimeCreationTaskQueue } from './worker/types'

@Module({
    exports: [ShowtimeCreationService, ShowtimeCreationEvents],
    imports: [
        NatsPubSubModule.register({ natsName: NATS_CONNECTION_NAME }),
        CacheModule.register({
            name: 'showtime-creation',
            prefix: `cache:${getProjectId()}`,
            redisName: REDIS_CONNECTION_NAME
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
        // worker provider를 이 모듈에 직접 두어 `ShowtimeCreationActivities`를
        // 같은 provider 범위에서 주입받습니다. 별도 자식 모듈로 감싸면 factory가
        // 이 모듈의 provider를 볼 수 없습니다.
        {
            inject: [AppConfigService, ShowtimeCreationActivities],
            provide: TemporalWorkerService,
            useFactory: (config: AppConfigService, activities: ShowtimeCreationActivities) =>
                new TemporalWorkerService({
                    activities: activities.bind(),
                    address: config.temporal.address,
                    namespace: config.temporal.namespace,
                    taskQueue: getShowtimeCreationTaskQueue(),
                    workflowBundlePath: showtimeCreationBundle.bundlePath
                })
        }
    ]
})
export class ShowtimeCreationModule {}
