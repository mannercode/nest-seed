import { NatsPubSubModule } from '@mannercode/common'
import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { MONGO_CONNECTION_NAME, NATS_CONNECTION_NAME } from 'config'
import { MoviesModule, ShowtimesModule, TheatersModule, TicketsModule } from 'core'
import {
    ShowtimeBulkCreatorService,
    ShowtimeBulkValidatorService,
    ShowtimeCreationOrchestratorService,
    ShowtimeCreationPersistenceService,
    ShowtimeCreationSubmissionRepository
} from './internal'
import {
    ShowtimeCreationOperation,
    ShowtimeCreationOperationSchema,
    ShowtimeCreationSubmission,
    ShowtimeCreationSubmissionSchema
} from './internal/models'
import { ShowtimeCreationOperationRepository } from './internal/showtime-creation-operation.repository'
import { ShowtimeCreationEvents } from './showtime-creation.events'
import { ShowtimeCreationService } from './showtime-creation.service'
import { ShowtimeCreationRestateEndpoint } from './worker/restate-endpoint.service'
import { ShowtimeCreationWorkflowClient } from './worker/restate-workflow-client.service'
import { ShowtimeCreationWorkflow } from './worker/workflow'

@Module({
    exports: [ShowtimeCreationService, ShowtimeCreationEvents],
    imports: [
        NatsPubSubModule.register({ natsName: NATS_CONNECTION_NAME }),
        MongooseModule.forFeature(
            [
                { name: ShowtimeCreationOperation.name, schema: ShowtimeCreationOperationSchema },
                { name: ShowtimeCreationSubmission.name, schema: ShowtimeCreationSubmissionSchema }
            ],
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
        ShowtimeCreationSubmissionRepository,
        ShowtimeCreationPersistenceService,
        ShowtimeCreationWorkflow,
        ShowtimeCreationWorkflowClient,
        ShowtimeCreationRestateEndpoint
    ]
})
export class ShowtimeCreationModule {}
