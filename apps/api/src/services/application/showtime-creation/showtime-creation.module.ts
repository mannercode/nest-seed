import { CacheModule, NatsPubSubModule, TemporalWorkerService } from '@mannercode/common'
import { Module } from '@nestjs/common'
import { AppConfigService, getProjectId, NATS_CONNECTION_NAME, REDIS_CONNECTION_NAME } from 'config'
import { MoviesModule, ShowtimesModule, TheatersModule, TicketsModule } from 'core'
import path from 'path'
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
        // `TemporalWorkerService` 를 같은 모듈의 provider 로 둔다. 그래야 이
        // 모듈 안의 `ShowtimeCreationActivities` 를 useFactory 에서 주입받을
        // 수 있다. `TemporalWorkerModule.forRootAsync` 처럼 자식 모듈로 감싸
        // 만들면, useFactory 가 자식 모듈 범위에서 돌면서 이 모듈의 provider
        // 를 못 본다.
        {
            inject: [AppConfigService, ShowtimeCreationActivities],
            provide: TemporalWorkerService,
            useFactory: (config: AppConfigService, activities: ShowtimeCreationActivities) =>
                new TemporalWorkerService({
                    activities: activities.bind(),
                    address: config.temporal.address,
                    namespace: config.temporal.namespace,
                    taskQueue: getShowtimeCreationTaskQueue(),
                    // 운영 환경에서는 빌드 단계의 `scripts/bundle-workflows.js`
                    // 가 만든 번들이 `dist/index.js` 옆에 놓인다. dev 와
                    // 테스트에서는 그 파일이 없으므로, 서비스가
                    // `workflowsPath` 를 보고 그 자리에서 번들을 만든다.
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
