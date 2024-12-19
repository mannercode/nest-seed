import { Module } from '@nestjs/common'
import { Modules } from './modules'
import { HealthModule, PaymentsModule, StorageFilesModule } from './services'

@Module({
    imports: [Modules, HealthModule, PaymentsModule, StorageFilesModule]
})
export class InfrastructuresModule {}
