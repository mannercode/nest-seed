import { Injectable } from '@nestjs/common'
import { CustomerJwtAuthGuard } from './customer-jwt-auth.guard'

@Injectable()
export class CustomerOptionalJwtAuthGuard extends CustomerJwtAuthGuard {
    handleRequest(err: any, user: any, info: any, context: any) {
        if (err || !user) {
            return { userId: null, email: null }
        }

        return user
    }
}
