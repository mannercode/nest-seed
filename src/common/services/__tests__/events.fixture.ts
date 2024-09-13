import { Injectable } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { AppEvent, EventName } from 'common'

@EventName('sample.event')
export class SampleEvent extends AppEvent {
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
