import { Module } from '@nestjs/common'
import { UsersModule } from '#core'
import { AssetsModule } from '#infrastructure'
import { RegistrationTransactionRepository } from './registration-transaction.repository.js'
import { UserRegistrationService } from './user-registration.service.js'

@Module({
    imports: [UsersModule, AssetsModule],
    providers: [UserRegistrationService, RegistrationTransactionRepository],
    exports: [UserRegistrationService]
})
export class UserRegistrationModule {}
