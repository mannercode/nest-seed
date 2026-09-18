import { ensure, IdempotencyErrors } from '@mannercode/common'
import { ConflictException, HttpException } from '@nestjs/common'
import { PurchaseRecordSchema, PurchaseRecordStatus } from '#core'
import { z } from 'zod'

export const PurchaseOperationSchema = z.object({
    errorResponse: z.record(z.string(), z.unknown()).nullable(),
    errorStatus: z.number().nullable(),
    fingerprint: z.string().nullable(),
    response: PurchaseRecordSchema.optional(),
    purchaseRecord: PurchaseRecordSchema,
    status: z.enum(PurchaseRecordStatus)
})
export type PurchaseOperation = z.infer<typeof PurchaseOperationSchema>

export const PurchaseFailureSchema = z.object({
    kind: z.literal('failed'),
    response: z.record(z.string(), z.unknown()),
    status: z.number()
})
export type PurchaseFailure = z.infer<typeof PurchaseFailureSchema>

export const PurchaseResultSchema = z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('completed'), response: PurchaseRecordSchema }),
    PurchaseFailureSchema
])
export type PurchaseResult = z.infer<typeof PurchaseResultSchema>

export const purchaseStepSchema = <T extends z.ZodType>(value: T) =>
    z.discriminatedUnion('kind', [
        z.object({ kind: z.literal('succeeded'), value }),
        PurchaseFailureSchema
    ])

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
