import { Module } from '@nestjs/common'
import { AssetsModule } from './assets'
import { PaymentsModule } from './payments'

// GlobalModule 은 @Global 이라 여기 나열할 필요 없음.
@Module({ imports: [PaymentsModule, AssetsModule], exports: [PaymentsModule, AssetsModule] })
export class InfrastructureModule {}
