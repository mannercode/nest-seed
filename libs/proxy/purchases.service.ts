import { Injectable } from '@nestjs/common'
import { ClientProxyService, MethodLog } from 'common'
import { Observable } from 'rxjs'
import { PurchaseCreateDto, PurchaseDto } from 'types'

@Injectable()
export class PurchasesService {
    constructor(private service: ClientProxyService) {}

    @MethodLog({ level: 'verbose' })
    createPurchase(createDto: PurchaseCreateDto): Observable<PurchaseDto> {
        return this.service.send('createPurchase', createDto)
    }

    @MethodLog({ level: 'verbose' })
    getPurchase(purchaseId: string): Observable<PurchaseDto> {
        return this.service.send('getPurchase', purchaseId)
    }
}
