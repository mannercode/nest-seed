import { Injectable } from '@nestjs/common'
import { MethodLog } from 'common'
import { nullPurchase, PurchaseCreateDto, PurchaseDto } from 'types'

@Injectable()
export class PurchaseProcessService {
    constructor() {}

    @MethodLog()
    async processPurchase(createDto: PurchaseCreateDto): Promise<PurchaseDto> {
        return nullPurchase
    }
}
