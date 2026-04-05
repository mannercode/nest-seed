import { Injectable } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import type { ShowtimeCreationEvent } from './services/types'

@Injectable()
export class ShowtimeCreationEvents {
    constructor(private readonly eventEmitter: EventEmitter2) {}

    emitStatusChanged(payload: ShowtimeCreationEvent) {
        this.eventEmitter.emit('showtime-creation.statusChanged', payload)
    }
}
