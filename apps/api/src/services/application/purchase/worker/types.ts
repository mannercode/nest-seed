import type { CreatePurchaseDto } from '../dtos/index.js'

export type PurchaseWorkflowInput = {
    createDto: CreatePurchaseDto
    fingerprint: string
    idempotencyKey: string
    userId: string
}
