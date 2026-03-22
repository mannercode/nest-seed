import { ClientProxyService } from '@mannercode/nest-microservice'
import { InjectClientProxy } from '@mannercode/nest-microservice'
import { Injectable } from '@nestjs/common'
import { Events } from 'common'
import type { ShowtimeCreationEvent } from './services/types'

@Injectable()
export class ShowtimeCreationEvents {
    constructor(@InjectClientProxy() private readonly proxy: ClientProxyService) {}

    emitStatusChanged(payload: ShowtimeCreationEvent) {
        return this.proxy.emit(Events.ShowtimeCreation.statusChanged, payload)
    }
}
