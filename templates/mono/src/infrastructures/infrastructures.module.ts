import { Module } from '@nestjs/common'
import { CommonModule } from 'common'
import { AssetsModule, PaymentsModule } from './services'

@Module({
    imports: [CommonModule, PaymentsModule, AssetsModule],
    exports: [PaymentsModule, AssetsModule]
})
export class InfrastructuresModule {}
