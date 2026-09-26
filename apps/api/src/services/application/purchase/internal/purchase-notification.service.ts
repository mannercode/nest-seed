import type { DurableMessages, DurableMessage } from '@mannercode/common'
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { PurchaseEventService, ticketPurchasedEventSchema } from '../purchase-event.service.js'

const RETRY_DELAY_MS = 1000

// 모든 복제본이 같은 durable pull consumer를 공유한다. JetStream은 적어도 한 번 전달하므로
// 실제 알림 발송자는 purchaseRecordId를 durable inbox/provider idempotency key로 써야 한다.
@Injectable()
export class PurchaseNotificationService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(PurchaseNotificationService.name)
    private consumeTask: Promise<void> | undefined
    private messages: DurableMessages | undefined
    private stopping = false

    constructor(private readonly events: PurchaseEventService) {}

    async onModuleInit() {
        this.stopping = false
        const messages = await this.events.consumeNotifications()
        this.messages = messages
        this.consumeTask = this.consume(messages)
    }

    async onModuleDestroy() {
        this.stopping = true
        const messages = this.messages
        const consumeTask = this.consumeTask
        this.messages = undefined
        this.consumeTask = undefined
        await messages?.close()
        await consumeTask
    }

    private async consume(messages: DurableMessages) {
        try {
            for await (const message of messages) {
                await this.process(message)
            }
            if (!this.stopping) {
                this.logger.error('purchase notification consumer stopped unexpectedly')
            }
        } catch (error) {
            if (!this.stopping) {
                this.logger.error('purchase notification consumer failed', error)
            }
        }
    }

    private async process(message: DurableMessage) {
        let payload: unknown
        try {
            payload = message.decode()
        } catch (error) {
            this.rejectInvalid(message, error)
            return
        }

        const parsed = ticketPurchasedEventSchema.safeParse(payload)
        if (!parsed.success) {
            this.rejectInvalid(message, parsed.error)
            return
        }

        const event = parsed.data
        try {
            this.logger.log('would send purchase confirmation', {
                dedupeKey: event.purchaseRecordId,
                purchaseRecordId: event.purchaseRecordId,
                ticketCount: event.ticketIds.length,
                userId: event.userId
            })
            message.acknowledge()
        } catch (error) {
            this.logger.error('purchase notification retry scheduled', {
                deliveryCount: message.deliveryCount,
                error,
                purchaseRecordId: event.purchaseRecordId
            })
            message.retryAfter(RETRY_DELAY_MS)
        }
    }

    private rejectInvalid(message: DurableMessage, error: unknown) {
        this.logger.error('invalid purchase notification event', {
            error,
            streamSequence: message.sequence
        })
        message.discard('invalid purchase notification event')
    }
}
