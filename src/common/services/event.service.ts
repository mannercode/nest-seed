import { Injectable } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'

export abstract class AppEvent {
    static eventName: string
    public name: string

    constructor() {
        this.name = ''
    }
}

export function EventName(name: string) {
    return function <T extends new (...args: any[]) => AppEvent>(constructor: T) {
        return class extends constructor {
            static eventName = name
            constructor(...args: any[]) {
                super(...args)
                this.name = name
            }
        }
    }
}

@Injectable()
export class EventService {
    constructor(private eventEmitter: EventEmitter2) {}

    async emit(event: AppEvent) {
        await this.eventEmitter.emitAsync(event.name, event)
    }
}
