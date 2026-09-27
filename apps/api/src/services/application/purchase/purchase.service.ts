import { IdempotencyErrors, JsonUtil, sha256 } from '@mannercode/common'
import { ConflictException, HttpException, Injectable } from '@nestjs/common'
import { PurchaseRecordsService, TicketsService, TicketStatus, type PurchaseRecordDto } from '#core'
import { CreatePurchaseDto } from './dtos/index.js'
import { PurchaseErrors } from './errors.js'
import { TicketPurchaseService } from './internal/index.js'
import {
    purchaseResult,
    type PurchaseOperation,
    type PurchaseResult
} from './internal/purchase-result.js'
import { PurchaseWorkflowClient } from './worker/index.js'

@Injectable()
export class PurchaseService {
    constructor(
        private readonly purchaseRecordsService: PurchaseRecordsService,
        private readonly ticketPurchaseService: TicketPurchaseService,
        private readonly ticketsService: TicketsService,
        private readonly workflow: PurchaseWorkflowClient
    ) {}

    async processPurchase(createDto: CreatePurchaseDto, userId: string, idempotencyKey: string) {
        const fingerprint = this.fingerprint(createDto)
        const existing = await this.purchaseRecordsService.findIdempotencyOperation({
            userId,
            idempotencyKey
        })
        if (existing) return this.replayIdempotencyOperation(existing, fingerprint)

        const ticketIds = createDto.purchaseItems.map((item) => item.itemId)
        try {
            const tickets = await this.ticketsService.getMany(ticketIds)
            const unavailable = tickets.filter((t) => t.status !== TicketStatus.Available)
            if (unavailable.length > 0) {
                throw new ConflictException(
                    PurchaseErrors.AlreadySold(unavailable.map((t) => t.id))
                )
            }
            await this.ticketPurchaseService.validatePurchase(createDto, userId)
        } catch (error) {
            // 최초 조회 뒤 같은 키의 다른 요청이 티켓을 구매에 할당하거나 판매를 끝냈을 수 있다.
            // 현재 티켓 상태만으로 거절하지 않고, 먼저 접수한 요청의 결과를 반환한다.
            const concurrent = await this.purchaseRecordsService.findIdempotencyOperation({
                userId,
                idempotencyKey
            })
            if (concurrent) return this.replayIdempotencyOperation(concurrent, fingerprint)
            throw error
        }

        // Restate가 요청을 저장한 뒤 workflow에서 구매 기록을 만든다.
        // 구매 기록만 저장하고 workflow를 제출하지 못한 채 API가 종료되는 상황을 막는다.
        // 같은 키에 다른 본문을 보낸 동시 요청은 별도 workflow로 실행되며, DB의 고유 키로 구매 기록 중복을 막는다.
        const workflowId = sha256(JsonUtil.stringify([userId, idempotencyKey, fingerprint]), 'hex')
        const submission = await this.workflow.submit(
            { createDto, fingerprint, idempotencyKey, userId },
            workflowId
        )
        if (submission.status === 'PreviouslyAccepted') {
            const operation = await this.purchaseRecordsService.findIdempotencyOperation({
                userId,
                idempotencyKey
            })
            if (operation) return this.replayIdempotencyOperation(operation, fingerprint)
            throw new ConflictException(IdempotencyErrors.RequestInProgress())
        }
        return this.unwrap(await this.workflow.waitForCompletion(submission))
    }

    private fingerprint(createDto: CreatePurchaseDto) {
        const normalized = {
            purchaseItems: [...createDto.purchaseItems]
                .map(({ itemId, type }) => ({ itemId, type }))
                .sort((a, b) => `${a.type}:${a.itemId}`.localeCompare(`${b.type}:${b.itemId}`)),
            totalPrice: createDto.totalPrice
        }
        return sha256(JsonUtil.stringify(normalized), 'hex')
    }

    private replayIdempotencyOperation(
        operation: PurchaseOperation,
        fingerprint: string
    ): PurchaseRecordDto {
        if (operation.fingerprint !== fingerprint)
            throw new ConflictException(IdempotencyErrors.KeyReused())
        return this.unwrap(purchaseResult(operation))
    }

    private unwrap(result: PurchaseResult): PurchaseRecordDto {
        if (result.kind === 'failed') throw new HttpException(result.response, result.status)
        return result.response
    }
}
