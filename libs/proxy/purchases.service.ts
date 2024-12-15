import { Injectable } from '@nestjs/common'
import { MethodLog } from 'common'
import { nullPurchase, PurchaseCreateDto, PurchaseDto } from 'types'

@Injectable()
export class PurchasesService {
    constructor() {}

    @MethodLog()
    async createPurchase(createDto: PurchaseCreateDto): Promise<PurchaseDto> {
        return nullPurchase
    }

    @MethodLog({ level: 'verbose' })
    async getPurchase(purchaseId: string): Promise<PurchaseDto> {
        return nullPurchase
    }
}
