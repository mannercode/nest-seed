import type { INestApplication } from '@nestjs/common'
import { JsonUtil } from '@mannercode/common'

export function configureTemporalJson(app: INestApplication): void {
    app.getHttpAdapter().getInstance().set('json replacer', JsonUtil.temporalReplacer)
}
