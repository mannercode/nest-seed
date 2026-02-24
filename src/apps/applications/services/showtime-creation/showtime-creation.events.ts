import { Injectable } from '@nestjs/common'
import { ClientProxyService } from 'common'
import { InjectClientProxy } from 'common'
import { Events } from 'shared'
import type { ShowtimeCreationEvent } from './services/types'

@Injectable()
export class ShowtimeCreationEvents {
    constructor(@InjectClientProxy() private readonly proxy: ClientProxyService) {}

    emitStatusChanged(payload: ShowtimeCreationEvent) {
        return this.proxy.emit(Events.ShowtimeCreation.statusChanged, payload)
    }
}
