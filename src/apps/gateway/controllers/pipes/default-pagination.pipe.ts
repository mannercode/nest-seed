import { Injectable } from '@nestjs/common'
import { PaginationPipe } from 'common'
import { GatewayConfigService } from 'gateway/config'

@Injectable()
export class DefaultPaginationPipe extends PaginationPipe {
    constructor(protected config: GatewayConfigService) {
        super()
    }

    get takeLimit(): number {
        return this.config.http.paginationDefaultSize
    }
}
