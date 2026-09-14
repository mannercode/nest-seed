import { RestateHealthIndicator as CommonRestateHealthIndicator } from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { AppConfigService } from '#config'

@Injectable()
export class RestateHealthIndicator extends CommonRestateHealthIndicator {
    constructor(config: AppConfigService) {
        super(config.restate.ingressUrl)
    }
}
