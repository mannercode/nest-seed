import { AppLoggerService, RestateEndpoint } from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { AppConfigService } from '#config'
import { ShowtimeCreationWorkflow } from './workflow.js'

@Injectable()
export class ShowtimeCreationRestateEndpoint extends RestateEndpoint {
    constructor(
        workflow: ShowtimeCreationWorkflow,
        config: AppConfigService,
        logger: AppLoggerService
    ) {
        super([workflow.definition], config.restate.servicePort, logger)
    }
}
