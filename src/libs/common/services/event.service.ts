import { DynamicModule, Injectable, Module } from '@nestjs/common'
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter'
import { EventEmitterModuleOptions } from '@nestjs/event-emitter/dist/interfaces'

export abstract class BaseEvent {
    static eventName: string
    public name: string

    constructor() {
        this.name = ''
    }
}

export function DefineEvent(name: string) {
    return function <T extends new (...args: any[]) => BaseEvent>(constructor: T) {
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

    async emit(event: BaseEvent) {
        await this.eventEmitter.emitAsync(event.name, event)
    }
}

@Module({})
export class EventModule {
    static forRoot(options?: EventEmitterModuleOptions): DynamicModule {
        return {
            module: EventModule,
            imports: [
                EventEmitterModule.forRoot({
                    global: true,
                    wildcard: true,
                    delimiter: '.',
                    newListener: false,
                    removeListener: false,
                    maxListeners: 10,
                    verboseMemoryLeak: false,
                    ignoreErrors: false,
                    ...options
                })
            ],
            exports: [EventEmitterModule]
        }
    }
}
