import { type DurableMessage, type DurableMessages } from '@mannercode/common'
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { DemoMessageSchema } from '../dtos.js'
import { EventDemoService } from '../event-demo.service.js'

@Injectable()
export class MessageConsumer implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(MessageConsumer.name)
    private messages: DurableMessages | undefined
    private task: Promise<void> | undefined
    private stopping = false
    constructor(private readonly events: EventDemoService) {}
    async onModuleInit() {
        this.messages = await this.events.consume()
        this.task = this.consume(this.messages)
    }
    async onModuleDestroy() {
        this.stopping = true
        await this.messages?.close()
        await this.task
    }
    private async consume(messages: DurableMessages) {
        try {
            for await (const message of messages) await this.process(message)
            if (!this.stopping) this.logger.error('Message consumer stopped unexpectedly')
        } catch (error) {
            if (!this.stopping) this.logger.error('Message consumer failed', error)
        }
    }
    private async process(message: DurableMessage) {
        let event
        try {
            event = DemoMessageSchema.parse(message.decode())
        } catch (error) {
            this.logger.error('Invalid demo message', error)
            message.discard('Invalid demo message')
            return
        }
        try {
            // NATS의 전달 확인 뒤 ack한다. 재전달 때 같은 id가 다시 올 수 있다.
            await this.events.deliver(event)
            message.acknowledge()
        } catch (error) {
            this.logger.error('Demo message delivery failed', error)
            message.retryAfter(1000)
        }
    }
}
