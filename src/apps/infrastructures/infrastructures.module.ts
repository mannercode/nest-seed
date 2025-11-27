import { Module } from '@nestjs/common'
import { CommonModule, MongooseConfigModule } from 'shared'
import { HealthModule } from './modules'
import { AttachmentsModule, PaymentsModule } from './services'

@Module({
    imports: [CommonModule, MongooseConfigModule, HealthModule, PaymentsModule, AttachmentsModule]
})
export class InfrastructuresModule {}
