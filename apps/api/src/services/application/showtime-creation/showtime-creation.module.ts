import { CacheModule, NatsPubSubModule, TemporalWorkerService } from '@mannercode/common'
import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import {
    AppConfigService,
    MONGO_CONNECTION_NAME,
    NATS_CONNECTION_NAME,
    REDIS_CONNECTION_NAME
} from 'config'
import { MoviesModule, ShowtimesModule, TheatersModule, TicketsModule } from 'core'
import {
    ShowtimeBulkCreatorService,
    ShowtimeBulkValidatorService,
    ShowtimeCreationOrchestratorService,
    ShowtimeCreationPersistenceService
} from './internal'
import { ShowtimeCreationOperation, ShowtimeCreationOperationSchema } from './internal/models'
import { ShowtimeCreationOperationRepository } from './internal/showtime-creation-operation.repository'
import {
    getLegacyShowtimeCreationTaskQueue,
    getShowtimeCreationTaskQueue
} from './showtime-creation-task-queue'
import { ShowtimeCreationEvents } from './showtime-creation.events'
import { ShowtimeCreationService } from './showtime-creation.service'
import { ShowtimeCreationActivities } from './worker/activities'
import { legacyShowtimeCreationBundle, showtimeCreationBundle } from './worker/bundle'
import { LegacyShowtimeCreationActivities } from './worker/legacy-activities'

const LEGACY_SHOWTIME_CREATION_WORKER = Symbol('LEGACY_SHOWTIME_CREATION_WORKER')
const SHOWTIME_CREATION_WORKER = Symbol('SHOWTIME_CREATION_WORKER')

@Module({
    exports: [ShowtimeCreationService, ShowtimeCreationEvents],
    imports: [
        NatsPubSubModule.register({ natsName: NATS_CONNECTION_NAME }),
        // v2도 rolling migration 동안 v1 binary와 같은 lock key를 사용한다.
        // original Temporal queue가 완전히 drain된 뒤 별도 릴리스에서 제거할 수 있다.
        CacheModule.register({
            inject: [AppConfigService],
            name: 'showtime-creation',
            prefix: (config: AppConfigService) => `cache:${config.projectId}`,
            redisName: REDIS_CONNECTION_NAME
        }),
        MongooseModule.forFeature(
            [{ name: ShowtimeCreationOperation.name, schema: ShowtimeCreationOperationSchema }],
            MONGO_CONNECTION_NAME
        ),
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
        ShowtimeCreationOperationRepository,
        ShowtimeCreationPersistenceService,
        LegacyShowtimeCreationActivities,
        ShowtimeCreationActivities,
        // 워커 제공자를 이 모듈에 직접 두어 `ShowtimeCreationActivities`를 같은 제공자 범위에서 주입받는다.
        // 별도 자식 모듈로 감싸면 factory가 이 모듈의 제공자를 볼 수 없다.
        {
            inject: [AppConfigService, LegacyShowtimeCreationActivities],
            provide: LEGACY_SHOWTIME_CREATION_WORKER,
            useFactory: (config: AppConfigService, activities: LegacyShowtimeCreationActivities) =>
                new TemporalWorkerService({
                    activities: activities.bind(),
                    address: config.temporal.address,
                    // poller 수만 낮춘다. 실행 slot은 넉넉히 유지해야 오래 잠긴 v1 validate 작업이
                    // compensate/상태 발행 Activity를 굶기지 않는다.
                    maxConcurrentActivityTaskExecutions: 100,
                    maxConcurrentActivityTaskPolls: 1,
                    maxConcurrentWorkflowTaskExecutions: 2,
                    maxConcurrentWorkflowTaskPolls: 2,
                    namespace: config.temporal.namespace,
                    taskQueue: getLegacyShowtimeCreationTaskQueue(config.projectId),
                    workflowBundlePath: legacyShowtimeCreationBundle.bundlePath
                })
        },
        {
            inject: [AppConfigService, ShowtimeCreationActivities],
            provide: SHOWTIME_CREATION_WORKER,
            useFactory: (config: AppConfigService, activities: ShowtimeCreationActivities) =>
                new TemporalWorkerService({
                    activities: activities.bind(),
                    address: config.temporal.address,
                    namespace: config.temporal.namespace,
                    taskQueue: getShowtimeCreationTaskQueue(config.projectId),
                    workflowBundlePath: showtimeCreationBundle.bundlePath
                })
        }
    ]
})
export class ShowtimeCreationModule {}
