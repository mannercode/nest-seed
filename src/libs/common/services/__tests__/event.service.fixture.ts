import { Injectable } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { BaseEvent, DefineEvent } from 'common'

@DefineEvent('sample.event')
export class SampleEvent extends BaseEvent {
    constructor(public text: string) {
        super()
    }
}

@Injectable()
export class AppEventListener {
    @OnEvent(SampleEvent.eventName)
    onSampleEvent(_: SampleEvent): void {}

    @OnEvent('sample.*')
    onWildEvent(_: SampleEvent): void {}

    @OnEvent('**')
    onAnyEvent(_: SampleEvent): void {}
}
