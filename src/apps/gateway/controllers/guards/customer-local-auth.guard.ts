import { Injectable, UnauthorizedException } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { AuthErrors } from './errors'

@Injectable()
export class CustomerLocalAuthGuard extends AuthGuard('customer-local') {
    handleRequest(error: any, user: any) {
        if (error || !user) {
            throw new UnauthorizedException(AuthErrors.Unauthorized())
        }

        return user
    }
}
