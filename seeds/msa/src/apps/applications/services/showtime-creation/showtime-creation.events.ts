import { ClientProxyService, InjectClientProxy } from '@mannercode/microservices'
import { Injectable } from '@nestjs/common'
import { Events } from 'config'
import type { ShowtimeCreationEvent } from './services/types'

@Injectable()
export class ShowtimeCreationEvents {
    constructor(@InjectClientProxy() private readonly proxy: ClientProxyService) {}

    emitStatusChanged(payload: ShowtimeCreationEvent) {
        return this.proxy.emit(Events.ShowtimeCreation.statusChanged, payload)
    }
}
