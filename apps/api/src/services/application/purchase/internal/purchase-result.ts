import { ensure, IdempotencyErrors } from '@mannercode/common'
import { ConflictException, HttpException } from '@nestjs/common'
import { PurchaseRecordsService, PurchaseRecordStatus, type PurchaseRecordDto } from '#core'

export type PurchaseOperation = NonNullable<
    Awaited<ReturnType<PurchaseRecordsService['findIdempotencyOperation']>>
>

export type PurchaseFailure = { kind: 'failed'; response: Record<string, unknown>; status: number }

export type PurchaseResult = { kind: 'completed'; response: PurchaseRecordDto } | PurchaseFailure

export function purchaseResult(operation: PurchaseOperation): PurchaseResult {
    if (operation.status === PurchaseRecordStatus.Completed) {
        return { kind: 'completed', response: ensure(operation.response) }
    }
    if (operation.status === PurchaseRecordStatus.Cancelled) {
        return {
            kind: 'failed',
            response: ensure(operation.errorResponse),
            status: ensure(operation.errorStatus)
        }
    }
    throw new ConflictException(IdempotencyErrors.RequestInProgress())
}

/** 업무상 거절만 결과로 확정한다. 결과가 불명확한 인프라 실패는 Restate가 재시도한다. */
export async function attemptPurchaseStep<T>(
    operation: () => Promise<T>
): Promise<{ kind: 'succeeded'; value: T } | PurchaseFailure> {
    try {
        return { kind: 'succeeded', value: await operation() }
    } catch (error) {
        if (!(error instanceof HttpException) || error.getStatus() >= 500) throw error
        const response = error.getResponse()
        return {
            kind: 'failed',
            response:
                typeof response === 'string'
                    ? { message: response, statusCode: error.getStatus() }
                    : { ...response },
            status: error.getStatus()
        }
    }
}
