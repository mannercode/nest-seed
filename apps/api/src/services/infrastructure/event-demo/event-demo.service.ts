import {
    generateUuid,
    getNatsConnectionToken,
    InjectNatsPubSub,
    JetStreamChannel,
    JsonUtil,
    NatsPubSubService,
    sha256,
    type NatsConnection
} from '@mannercode/common'
import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { filter, Subject } from 'rxjs'
import { AppConfigService, NATS_CONNECTION_NAME } from '#config'
import { DemoMessageSchema, type DemoMessage, type PublishMessageDto } from './dtos.js'

export const DEMO_EVENTS_MAX_BYTES = Symbol('DEMO_EVENTS_MAX_BYTES')
@Injectable()
export class EventDemoService implements OnModuleInit, OnModuleDestroy {
    private readonly channel: JetStreamChannel
    readonly subjects: { queued: string; received: string }
    private readonly received = new Subject<DemoMessage>()
    private readonly handler = (message: string) =>
        this.received.next(DemoMessageSchema.parse(JSON.parse(message)))
    constructor(
        @Inject(getNatsConnectionToken(NATS_CONNECTION_NAME)) connection: NatsConnection,
        @InjectNatsPubSub() private readonly pubsub: NatsPubSubService,
        config: AppConfigService,
        @Inject(DEMO_EVENTS_MAX_BYTES) maxBytes: number
    ) {
        const resourceId = sha256(config.projectId, 'hex').slice(0, 24).toUpperCase()
        this.subjects = {
            queued: config.projectId + '.event-demo.queued',
            received: config.projectId + '.event-demo.received'
        }
        this.channel = new JetStreamChannel(connection, {
            streamName: 'DEMO_EVENTS_' + resourceId,
            consumerName: 'DEMO_MESSAGES_' + resourceId,
            subject: this.subjects.queued,
            description: 'Message delivery example',
            maxAgeMs: 7 * 24 * 60 * 60 * 1000,
            duplicateWindowMs: 10 * 60 * 1000,
            ackWaitMs: 30 * 1000,
            maxBytes
        })
    }
    async onModuleInit() {
        await this.channel.initialize()
        await this.pubsub.subscribe(this.subjects.received, this.handler)
    }
    async onModuleDestroy() {
        await this.pubsub.unsubscribe(this.subjects.received, this.handler)
        this.received.complete()
    }
    async publish(userId: string, input: PublishMessageDto) {
        const event = DemoMessageSchema.parse({ ...input, id: generateUuid(), userId })
        await this.channel.publish(event, event.id)
        return { id: event.id }
    }
    consume() {
        return this.channel.consume()
    }
    async deliver(event: DemoMessage) {
        await this.pubsub.publish(this.subjects.received, JsonUtil.stringify(event))
    }
    observe(userId: string) {
        return this.received.pipe(filter((event) => event.userId === userId))
    }
}
