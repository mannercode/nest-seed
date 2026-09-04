import {
    CacheService,
    DateUtil,
    ensure,
    IdempotencyErrors,
    InjectCache,
    isDuplicateKeyError,
    JsonUtil
} from '@mannercode/common'
import { ConflictException, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common'
import { Interval } from '@nestjs/schedule'
import { createHash, randomUUID } from 'node:crypto'
import { MongoConnection } from '#config'
import {
    PurchaseRecordsService,
    PurchaseRecordStatus,
    TicketsService,
    TicketStatus,
    type PurchaseRecordDto
} from '#core'
import { PaymentsService } from '#infrastructure'
import { CreatePurchaseDto } from './dtos/index.js'
import { PurchaseErrors } from './errors.js'
import { TicketPurchaseService } from './internal/index.js'
import { PurchaseEvents } from './purchase.events.js'

const PURCHASE_LOCK_TTL_MS = 5 * 60 * 1000
const PURCHASE_LOCK_WAIT_MS = 10 * 60 * 1000
const PURCHASE_COMPLETION_LEASE_MS = 10 * 60 * 1000
const PURCHASE_RECONCILIATION_INTERVAL_MS = 60 * 1000
const PURCHASE_RECONCILIATION_LEASE_MS = 60 * 1000
const PURCHASE_RECONCILIATION_STALE_MS = 10 * 60 * 1000
const PURCHASE_EVENT_PUBLICATION_LEASE_MS = 60 * 1000

@Injectable()
export class PurchaseService {
    private readonly logger = new Logger(PurchaseService.name)

    constructor(
        private readonly purchaseRecordsService: PurchaseRecordsService,
        private readonly paymentsService: PaymentsService,
        private readonly ticketPurchaseService: TicketPurchaseService,
        private readonly ticketsService: TicketsService,
        private readonly events: PurchaseEvents,
        @InjectCache('purchase') private readonly cache: CacheService,
        private readonly mongoConnection: MongoConnection
    ) {}

    async processPurchase(createDto: CreatePurchaseDto, userId: string, idempotencyKey: string) {
        this.logger.log('processPurchase', { userId })

        const fingerprint = this.fingerprint(createDto)
        const existing = await this.purchaseRecordsService.findIdempotencyOperation(
            userId,
            idempotencyKey
        )
        if (existing) return this.replayIdempotencyOperation(existing, fingerprint)

        const ticketIds = createDto.purchaseItems.map((item) => item.itemId)
        const lockKey = `tickets:${ticketIds.sort().join(',')}`

        // 같은 티켓 묶음의 동시 결제를 직렬화해, 뒤따른 결제가 결제 기록을 만들기 전에 거절되도록 한다.
        // 단, 겹치지만 다른 묶음은 락 키가 달라 직렬화되지 않는다.
        // 이중 판매 방지 자체는 락이 아니라 `sellForPurchase`의 원자 전이(Available→Sold)가 보장한다.
        // 락은 불필요한 결제 생성·보상을 줄이는 최적화다.
        return this.cache.withLockBlocking(
            lockKey,
            PURCHASE_LOCK_TTL_MS,
            () =>
                this.processPurchaseLocked(
                    createDto,
                    userId,
                    ticketIds,
                    idempotencyKey,
                    fingerprint
                ),
            { waitMs: PURCHASE_LOCK_WAIT_MS }
        )
    }

    private async processPurchaseLocked(
        createDto: CreatePurchaseDto,
        userId: string,
        ticketIds: string[],
        idempotencyKey: string,
        fingerprint: string
    ) {
        const existing = await this.purchaseRecordsService.findIdempotencyOperation(
            userId,
            idempotencyKey
        )
        if (existing) return this.replayIdempotencyOperation(existing, fingerprint)

        const tickets = await this.ticketsService.getMany(ticketIds)
        const unavailable = tickets.filter((t) => t.status !== TicketStatus.Available)
        if (unavailable.length > 0) {
            throw new ConflictException(PurchaseErrors.AlreadySold(unavailable.map((t) => t.id)))
        }

        await this.ticketPurchaseService.validatePurchase(createDto, userId)

        // 외부 효과(결제·티켓 판매)보다 먼저 pending 행을 남긴다. 프로세스가 어느 줄에서
        // 죽더라도 이 행이 reconciliation의 재시도 기준점이 된다.
        let purchaseRecord: PurchaseRecordDto
        try {
            purchaseRecord = await this.purchaseRecordsService.create(
                { ...createDto, paymentId: null, userId },
                { idempotency: { fingerprint, key: idempotencyKey }, pending: true }
            )
        } catch (error) {
            if (!isDuplicateKeyError(error)) throw error

            const winner = ensure(
                await this.purchaseRecordsService.findIdempotencyOperation(userId, idempotencyKey),
                'Purchase idempotency winner is missing after a duplicate-key conflict.'
            )
            return this.replayIdempotencyOperation(winner, fingerprint)
        }
        this.logger.log('processPurchase createPurchaseRecord completed', {
            purchaseRecordId: purchaseRecord.id
        })

        let completed: PurchaseRecordDto
        let completionId: string | undefined
        try {
            // 검증 뒤 TTL 만료/재선점 경쟁을 결제 전에 닫는다. claim은 purchaseRecordId를
            // owner로 사용하므로 이후 보상도 다른 사용자의 hold를 건드리지 않고 멱등이다.
            await this.ticketPurchaseService.claimPurchase(createDto, userId, purchaseRecord.id)

            const payment = await this.paymentsService.create({
                amount: createDto.totalPrice,
                purchaseRecordId: purchaseRecord.id,
                userId
            })
            this.logger.log('processPurchase createPayment completed', { paymentId: payment.id })

            try {
                purchaseRecord = await this.purchaseRecordsService.setPaymentId(
                    purchaseRecord.id,
                    payment.id
                )
            } catch (stateError) {
                // reconciliation이 payment 생성 중 먼저 이겼다면 취소 조회가 insert보다
                // 빨랐을 수 있다. payment 행의 durable resolution marker를 남긴 채 여기서도
                // 취소를 시도하고, 실패하면 주기 작업이 terminal 구매 상태와 다시 대조한다.
                try {
                    await this.paymentsService.cancelByPurchaseRecordId(purchaseRecord.id)
                } catch (cancellationError) {
                    this.logger.error('late payment cancellation deferred to durable resolution', {
                        error: cancellationError,
                        purchaseRecordId: purchaseRecord.id
                    })
                }
                throw stateError
            }

            const activeCompletionId = randomUUID()
            completionId = activeCompletionId
            await this.purchaseRecordsService.claimForCompletion(
                purchaseRecord.id,
                activeCompletionId,
                DateUtil.add({ milliseconds: PURCHASE_COMPLETION_LEASE_MS })
            )
            completed = await this.ticketPurchaseService.completePurchase(
                createDto,
                purchaseRecord.id,
                (completionTicketIds) =>
                    this.commitPurchase(completionTicketIds, purchaseRecord, activeCompletionId)
            )
            this.logger.log('processPurchase completed', { purchaseRecordId: purchaseRecord.id })
        } catch (error) {
            this.logger.warn('processPurchase reconciliation requested', {
                purchaseRecordId: purchaseRecord.id
            })
            const replayable = this.toReplayableError(error)
            try {
                await this.reconcilePurchase(
                    purchaseRecord.id,
                    DateUtil.now(),
                    completionId,
                    replayable
                )
            } catch (reconciliationError) {
                // 원래 구매 오류는 호출자에게 유지하고, durable 구매·결제 행은 주기 작업이 다시 찾는다.
                this.logger.error('purchase reconciliation deferred', {
                    error: reconciliationError,
                    purchaseRecordId: purchaseRecord.id
                })
            }
            throw error
        }

        // 구매 커밋 뒤에만 외부 이벤트를 발행한다. 실패해도 완료된 구매를 되돌리지 않고,
        // 같은 purchaseRecordId를 event id로 사용해 outbox 재시도 대상으로 남긴다.
        await this.publishPurchaseEvent(completed)
        return completed
    }

    private fingerprint(createDto: CreatePurchaseDto) {
        const normalized = {
            purchaseItems: [...createDto.purchaseItems]
                .map(({ itemId, type }) => ({ itemId, type }))
                .sort((a, b) => `${a.type}:${a.itemId}`.localeCompare(`${b.type}:${b.itemId}`)),
            totalPrice: createDto.totalPrice
        }
        return createHash('sha256').update(JsonUtil.stringify(normalized)).digest('hex')
    }

    private replayIdempotencyOperation(
        operation: NonNullable<
            Awaited<ReturnType<PurchaseRecordsService['findIdempotencyOperation']>>
        >,
        fingerprint: string
    ): PurchaseRecordDto {
        if (operation.fingerprint !== fingerprint) {
            throw new ConflictException(IdempotencyErrors.KeyReused())
        }

        if (operation.status === PurchaseRecordStatus.Completed) {
            return ensure(
                operation.response,
                'Completed idempotent purchase is missing its immutable response.'
            )
        }
        if (operation.status !== PurchaseRecordStatus.Cancelled) {
            throw new ConflictException(IdempotencyErrors.RequestInProgress())
        }
        if (operation.errorStatus && operation.errorResponse) {
            throw new HttpException(operation.errorResponse, operation.errorStatus)
        }
        throw new ConflictException(IdempotencyErrors.OperationFailed())
    }

    private toReplayableError(error: unknown): {
        response: Record<string, unknown>
        status: number
    } {
        if (error instanceof HttpException) {
            const response = error.getResponse()
            return {
                response:
                    typeof response === 'string'
                        ? { message: response, statusCode: error.getStatus() }
                        : { ...response },
                status: error.getStatus()
            }
        }

        return {
            response: {
                message: 'Internal server error',
                statusCode: HttpStatus.INTERNAL_SERVER_ERROR
            },
            status: HttpStatus.INTERNAL_SERVER_ERROR
        }
    }

    async reconcilePendingPurchases(before: Temporal.Instant = DateUtil.now()) {
        const pending = await this.purchaseRecordsService.findPendingBefore(before)
        for (const purchaseRecord of pending) {
            try {
                await this.reconcilePurchase(purchaseRecord.id, before)
            } catch (error) {
                this.logger.error('purchase reconciliation retry failed', {
                    error,
                    purchaseRecordId: purchaseRecord.id
                })
            }
        }
    }

    async publishPendingPurchaseEvents(before: Temporal.Instant = DateUtil.now()) {
        const unpublished = await this.purchaseRecordsService.findUnpublishedBefore(before)
        for (const purchaseRecord of unpublished) {
            await this.publishPurchaseEvent(purchaseRecord, before)
        }
    }

    async reconcileUnresolvedPayments(before: Temporal.Instant) {
        const unresolved = await this.paymentsService.findUnresolvedBefore(before)
        for (const payment of unresolved) {
            try {
                const { purchaseRecordId } = payment
                const status = await this.purchaseRecordsService.getStatusById(purchaseRecordId)
                if (status === PurchaseRecordStatus.Completed) {
                    await this.paymentsService.resolvePurchase(purchaseRecordId)
                } else if (status === PurchaseRecordStatus.Cancelled) {
                    await this.paymentsService.cancel(payment.id)
                }
            } catch (error) {
                this.logger.error('payment resolution retry failed', {
                    error,
                    paymentId: payment.id,
                    purchaseRecordId: payment.purchaseRecordId
                })
            }
        }
    }

    private async commitPurchase(
        ticketIds: string[],
        response: PurchaseRecordDto,
        completionId: string
    ): Promise<PurchaseRecordDto> {
        const purchaseRecordId = response.id
        const session = this.mongoConnection.client.startSession()
        try {
            // 같은 transaction에서 티켓과 completion lease 문서를 모두 쓰므로, lease를
            // 회수하는 reconciliation과 write conflict가 난다. 승자만 Sold+Completed를
            // 함께 커밋하고 패자의 티켓 쓰기는 rollback된다.
            return await session.withTransaction(async () => {
                await this.ticketsService.sellForPurchase(ticketIds, purchaseRecordId, session)
                await this.purchaseRecordsService.markCompleted(
                    purchaseRecordId,
                    completionId,
                    session,
                    response
                )
                await this.paymentsService.resolvePurchase(purchaseRecordId, session)
                return response
            })
        } finally {
            await session.endSession()
        }
    }

    @Interval('purchase-reconciliation', PURCHASE_RECONCILIATION_INTERVAL_MS)
    async reconcileStalePurchases() {
        const before = DateUtil.add({ milliseconds: -PURCHASE_RECONCILIATION_STALE_MS })
        await this.reconcilePendingPurchases(before)
        await this.reconcileUnresolvedPayments(before)
        await this.publishPendingPurchaseEvents()
    }

    private async reconcilePurchase(
        purchaseRecordId: string,
        before: Temporal.Instant,
        completionId?: string,
        idempotencyError?: { response: Record<string, unknown>; status: number }
    ) {
        const now = DateUtil.now()
        const reconciliationId = randomUUID()
        // stale 조회 결과를 그대로 믿지 않고 Pending→Compensating CAS를 획득한 replica만
        // 보상한다. 실패/프로세스 종료 시 lease가 만료돼 다른 replica가 이어받는다.
        const purchaseRecord = await this.purchaseRecordsService.claimForReconciliation(
            purchaseRecordId,
            {
                before,
                leaseUntil: DateUtil.add({
                    base: now,
                    milliseconds: PURCHASE_RECONCILIATION_LEASE_MS
                }),
                now,
                reconciliationId,
                completionId,
                idempotencyError
            }
        )
        if (!purchaseRecord) return

        try {
            const errors: unknown[] = []
            const steps: Array<[string, () => Promise<unknown>]> = [
                [
                    'releasePurchaseClaims',
                    () =>
                        this.ticketPurchaseService.compensatePurchase(
                            purchaseRecord,
                            purchaseRecord.id
                        )
                ],
                [
                    'cancelPayment',
                    () => this.paymentsService.cancelByPurchaseRecordId(purchaseRecord.id)
                ]
            ]

            for (const [step, action] of steps) {
                try {
                    await action()
                } catch (error) {
                    errors.push(error)
                    this.logger.error(`reconciliation step failed: ${step}`, {
                        error,
                        purchaseRecordId: purchaseRecord.id
                    })
                }
            }

            if (errors.length > 0) {
                throw new AggregateError(errors, 'Purchase reconciliation failed')
            }

            await this.purchaseRecordsService.markCancelled(purchaseRecord.id, reconciliationId)
        } catch (error) {
            // 즉시 재시도할 수 있게 lease를 만료시킨다. owner id CAS 덕분에 이미 lease를
            // 이어받은 다른 replica의 작업은 건드리지 않는다.
            try {
                await this.purchaseRecordsService.releaseReconciliationClaim(
                    purchaseRecord.id,
                    reconciliationId
                )
            } catch (leaseError) {
                this.logger.error('reconciliation lease release failed', {
                    error: leaseError,
                    purchaseRecordId: purchaseRecord.id
                })
            }
            throw error
        }
    }

    private async publishPurchaseEvent(
        purchaseRecord: PurchaseRecordDto,
        before: Temporal.Instant = DateUtil.now()
    ) {
        const ticketIds = purchaseRecord.purchaseItems.map((item) => item.itemId)
        const publicationId = randomUUID()

        try {
            const now = DateUtil.now()
            const claimed = await this.purchaseRecordsService.claimEventPublication(
                purchaseRecord.id,
                {
                    before,
                    leaseUntil: DateUtil.add({
                        base: now,
                        milliseconds: PURCHASE_EVENT_PUBLICATION_LEASE_MS
                    }),
                    now,
                    publicationId
                }
            )
            if (!claimed) return

            await this.events.emitTicketPurchased({
                purchaseRecordId: purchaseRecord.id,
                ticketIds,
                userId: purchaseRecord.userId
            })
            const published = await this.purchaseRecordsService.markEventPublished(
                purchaseRecord.id,
                publicationId
            )
            if (!published) {
                throw new Error(`Purchase event publication lease was lost: ${purchaseRecord.id}`)
            }
        } catch (error) {
            try {
                await this.purchaseRecordsService.releaseEventPublicationClaim(
                    purchaseRecord.id,
                    publicationId
                )
            } catch (releaseError) {
                this.logger.error('purchase event publication lease release failed', {
                    error: releaseError,
                    purchaseRecordId: purchaseRecord.id,
                    publicationId
                })
            }
            // completed + purchaseEventStatus=pending가 durable outbox다. NATS publish와
            // Mongo ack는 원자적이지 않아 publish 성공 후 ack 실패 시 재발행될 수 있다.
            // purchaseRecordId를 안정 dedupe key로 유지해 소비자가 at-least-once를 처리한다.
            this.logger.error('purchase event publish deferred', {
                error,
                purchaseRecordId: purchaseRecord.id,
                publicationId
            })
        }
    }
}
