import { NatsPubSubModule } from '@mannercode/common'
import { Module } from '@nestjs/common'
import { NATS_CONNECTION_NAME } from '#config'
import { DEMO_EVENTS_MAX_BYTES, EventDemoService } from './event-demo.service.js'
import { MessageConsumer } from './internal/message-consumer.js'
@Module({
    imports: [NatsPubSubModule.register({ natsName: NATS_CONNECTION_NAME })],
    providers: [
        EventDemoService,
        MessageConsumer,
        { provide: DEMO_EVENTS_MAX_BYTES, useValue: 256 * 1024 * 1024 }
    ],
    exports: [EventDemoService]
})
export class EventDemoModule {}
