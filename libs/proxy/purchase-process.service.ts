import { Injectable } from '@nestjs/common'
import { ClientProxyService, MethodLog } from 'common'
import { Observable } from 'rxjs'
import { PurchaseCreateDto, PurchaseDto } from 'types'

@Injectable()
export class PurchaseProcessService {
    constructor(private service: ClientProxyService) {}

    @MethodLog({ level: 'verbose' })
    processPurchase(createDto: PurchaseCreateDto): Observable<PurchaseDto> {
        return this.service.send('processPurchase', createDto)
    }
}
