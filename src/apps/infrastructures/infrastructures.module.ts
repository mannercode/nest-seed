import { Module } from '@nestjs/common'
import { CommonModule, MongooseConfigModule } from 'shared'
import { HealthModule } from './modules'
import { AssetsModule, PaymentsModule } from './services'

@Module({
    imports: [CommonModule, MongooseConfigModule, HealthModule, PaymentsModule, AssetsModule]
})
export class InfrastructuresModule {}
