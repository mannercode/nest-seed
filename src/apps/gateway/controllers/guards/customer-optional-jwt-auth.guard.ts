import { Injectable } from '@nestjs/common'
import { CustomerJwtAuthGuard } from './customer-jwt-auth.guard'

@Injectable()
export class CustomerOptionalJwtAuthGuard extends CustomerJwtAuthGuard {
    handleRequest(error: any, user: any, _info: any, _context: any) {
        if (error || !user) {
            return null
        }

        return user
    }
}
