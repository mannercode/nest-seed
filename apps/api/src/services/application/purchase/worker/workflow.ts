import {
    defineWorkflow,
    ensure,
    IdempotencyErrors,
    type DurableWorkflowContext
} from '@mannercode/common'
import { ConflictException, Injectable } from '@nestjs/common'
import { AppConfigService } from '#config'
import {
    PurchaseRecordIdempotencyConflictException,
    PurchaseRecordsService,
    PurchaseRecordSchema,
    PurchaseRecordStatus,
    TicketsService,
    type PurchaseRecordDto
} from '#core'
import { PaymentsService, PaymentSchema } from '#infrastructure'
import { PurchaseTransactionRepository, TicketPurchaseService } from '../internal/index.js'
import {
    attemptPurchaseStep,
    PurchaseOperationSchema,
    purchaseStepSchema,
    type PurchaseFailure,
    type PurchaseResult
} from '../internal/purchase-result.js'
import { PurchaseEventWorkflowClient } from './event-workflow-client.js'
import { PurchaseWorkflowInputSchema, type PurchaseWorkflowInput } from './types.js'

// 결제·DB·broker의 결과가 불명확한 실패를 취소 성공으로 간주하지 않는다.
// 업무상 거절은 값으로 기록하고, 그 밖의 실패는 횟수 제한 없이 복구한다.
const RETRY_UNTIL_RECOVERED = { initialRetryInterval: 1_000 }

@Injectable()
export class PurchaseWorkflow {
    readonly definition

    constructor(
        private readonly records: PurchaseRecordsService,
        private readonly payments: PaymentsService,
        private readonly ticketPurchase: TicketPurchaseService,
        private readonly tickets: TicketsService,
        private readonly transactions: PurchaseTransactionRepository,
        private readonly eventWorkflow: PurchaseEventWorkflowClient,
        config: AppConfigService
    ) {
        this.definition = defineWorkflow({
            name: `Purchase-${config.projectId}`,
            input: PurchaseWorkflowInputSchema,
            run: (ctx, input: PurchaseWorkflowInput) => this.run(ctx, input),
            options: {
                abortTimeout: 5_000,
                inactivityTimeout: 65_000,
                workflowRetention: 24 * 60 * 60 * 1_000
            }
        })
    }

    private async run(
        ctx: DurableWorkflowContext,
        input: PurchaseWorkflowInput
    ): Promise<PurchaseResult> {
        const reserved = purchaseStepSchema(PurchaseOperationSchema).parse(
            await ctx.run(
                'reserve purchase',
                () => attemptPurchaseStep(() => this.reserve(input)),
                RETRY_UNTIL_RECOVERED
            )
        )
        if (reserved.kind === 'failed') return reserved

        // 이 단계가 journal에 확정되어야 후속 단계가 시작된다.
        // 같은 workflow의 예약 재시도 시점에는 아직 pending이다.
        const record = reserved.value.purchaseRecord
        const { createDto, userId } = input

        const claimed = await ctx.run(
            'claim tickets',
            () =>
                attemptPurchaseStep(() =>
                    this.ticketPurchase.claimPurchase(createDto, userId, record.id)
                ),
            RETRY_UNTIL_RECOVERED
        )
        if (claimed.kind === 'failed') return this.compensate(ctx, input, record, claimed)

        const payment = PaymentSchema.parse(
            await ctx.run(
                'create payment',
                () =>
                    this.payments.create({
                        amount: createDto.totalPrice,
                        purchaseRecordId: record.id,
                        userId
                    }),
                RETRY_UNTIL_RECOVERED
            )
        )
        const response = PurchaseRecordSchema.parse(
            await ctx.run(
                'record payment',
                () => this.records.setPaymentId(record.id, payment.id),
                RETRY_UNTIL_RECOVERED
            )
        )

        const completed = purchaseStepSchema(PurchaseRecordSchema).parse(
            await ctx.run(
                'complete purchase',
                () =>
                    attemptPurchaseStep(async () => {
                        // DB 커밋 뒤 journal 응답을 잃은 재실행은 선점을 다시 요구하지 않는다.
                        const current = ensure(await this.records.findIdempotencyOperation(input))
                        if (current.status === PurchaseRecordStatus.Completed)
                            return ensure(current.response)

                        return this.ticketPurchase.completePurchase(
                            createDto,
                            record.id,
                            (ticketIds) =>
                                this.transactions.run(async (transaction) => {
                                    await this.tickets.sellForPurchase(
                                        ticketIds,
                                        record.id,
                                        transaction
                                    )
                                    await this.records.markCompleted(
                                        record.id,
                                        response,
                                        transaction
                                    )
                                    return response
                                })
                        )
                    }),
                RETRY_UNTIL_RECOVERED
            )
        )
        if (completed.kind === 'failed') return this.compensate(ctx, input, record, completed)

        return this.scheduleEvent(ctx, completed.value)
    }

    private async scheduleEvent(
        ctx: DurableWorkflowContext,
        response: PurchaseRecordDto
    ): Promise<PurchaseResult> {
        // 전송 작업의 접수까지만 기다린다. JetStream 장애는 구매 응답과 분리해 복구한다.
        await ctx.run(
            'schedule purchase event',
            () => this.eventWorkflow.submit(response, response.id),
            RETRY_UNTIL_RECOVERED
        )
        return { kind: 'completed', response }
    }

    private async reserve(input: PurchaseWorkflowInput) {
        try {
            await this.records.create(
                { ...input.createDto, paymentId: null, userId: input.userId },
                {
                    idempotency: { fingerprint: input.fingerprint, key: input.idempotencyKey },
                    pending: true
                }
            )
        } catch (error) {
            if (!(error instanceof PurchaseRecordIdempotencyConflictException)) throw error
        }
        const operation = ensure(await this.records.findIdempotencyOperation(input))
        if (operation.fingerprint !== input.fingerprint) {
            throw new ConflictException(IdempotencyErrors.KeyReused())
        }
        return operation
    }

    private async compensate(
        ctx: DurableWorkflowContext,
        input: PurchaseWorkflowInput,
        record: PurchaseRecordDto,
        failure: PurchaseFailure
    ): Promise<PurchaseResult> {
        const started = await ctx.run(
            'begin compensation',
            () => this.records.beginCompensation(record.id, failure),
            RETRY_UNTIL_RECOVERED
        )
        if (!started) {
            const operation = PurchaseOperationSchema.parse(
                await ctx.run(
                    'read terminal purchase',
                    async () => ensure(await this.records.findIdempotencyOperation(input)),
                    RETRY_UNTIL_RECOVERED
                )
            )
            return this.scheduleEvent(ctx, ensure(operation.response))
        }
        await ctx.run(
            'release ticket claims',
            () => this.ticketPurchase.compensatePurchase(record, record.id),
            RETRY_UNTIL_RECOVERED
        )
        await ctx.run(
            'cancel payment',
            () => this.payments.cancelByPurchaseRecordId({ purchaseRecordId: record.id }),
            RETRY_UNTIL_RECOVERED
        )
        await ctx.run(
            'record cancellation',
            () => this.records.markCancelled(record.id),
            RETRY_UNTIL_RECOVERED
        )
        return failure
    }
}
