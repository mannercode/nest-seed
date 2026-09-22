import { NatsPubSubModule } from '@mannercode/common'
import { Module } from '@nestjs/common'
import { NATS_CONNECTION_NAME } from '#config'
import { MoviesModule, ShowtimesModule, TheatersModule, TicketsModule } from '#core'
import {
    ShowtimeBulkCreatorService,
    ShowtimeBulkValidatorService,
    ShowtimeCreationPersistenceService,
    ShowtimeCreationSubmissionRepository
} from './internal/index.js'
import { ShowtimeCreationOperationRepository } from './internal/showtime-creation-operation.repository.js'
import { ShowtimeCreationEvents } from './showtime-creation.events.js'
import { ShowtimeCreationService } from './showtime-creation.service.js'
import { ShowtimeCreationWorkflowClient } from './worker/showtime-creation-workflow-client.js'
import { ShowtimeCreationWorkflow } from './worker/workflow.js'

@Module({
    exports: [ShowtimeCreationService, ShowtimeCreationEvents, ShowtimeCreationWorkflow],
    imports: [
        NatsPubSubModule.register({ natsName: NATS_CONNECTION_NAME }),
        MoviesModule,
        TheatersModule,
        ShowtimesModule,
        TicketsModule
    ],
    providers: [
        ShowtimeCreationEvents,
        ShowtimeCreationService,
        ShowtimeBulkValidatorService,
        ShowtimeBulkCreatorService,
        ShowtimeCreationOperationRepository,
        ShowtimeCreationSubmissionRepository,
        ShowtimeCreationPersistenceService,
        ShowtimeCreationWorkflow,
        ShowtimeCreationWorkflowClient
    ]
})
export class ShowtimeCreationModule {}
