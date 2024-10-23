import { Injectable } from '@nestjs/common'
import { PaginationPipe } from 'common'
import { AppConfigService } from 'config'

@Injectable()
export class DefaultPaginationPipe extends PaginationPipe {
    constructor(protected config: AppConfigService) {
        super()
    }

    get takeLimit(): number {
        return this.config.http.paginationDefaultSize
    }
}
