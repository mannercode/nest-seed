import { Module } from '@nestjs/common'
import { Modules } from './modules'
import { PaymentsModule, StorageFilesModule } from './services'

@Module({
    imports: [Modules, PaymentsModule, StorageFilesModule]
})
export class InfrastructuresModule {}
