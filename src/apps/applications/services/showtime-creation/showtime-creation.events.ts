import { Injectable } from '@nestjs/common'
import { ClientProxyService } from 'common'
import { InjectClientProxy } from 'common'
import { Events } from 'shared'

@Injectable()
export class ShowtimeCreationEvents {
    constructor(@InjectClientProxy() private readonly proxy: ClientProxyService) {}

    emitStatusChanged(payload: any) {
        return this.proxy.emit(Events.ShowtimeCreation.statusChanged, payload)
    }
}
