import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { GUARDS_METADATA } from '@nestjs/common/constants'
import { Reflector } from '@nestjs/core'
import { AuthGuard } from '@nestjs/passport'
import { Observable } from 'rxjs'
import { CustomerLocalAuthGuard } from './customer-local-auth.guard'
import { AuthErrors } from './errors'
import { IS_PUBLIC_KEY } from './public.decorator'

@Injectable()
export class CustomerJwtAuthGuard extends AuthGuard('customer-jwt') {
    constructor(private readonly reflector: Reflector) {
        super()
    }

    canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
        const isPublicRoute = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass()
        ])

        if (isPublicRoute) {
            return true
        }

        const handler = context.getHandler()
        const classRef = context.getClass()

        const isUsingLocalAuth =
            this.isUsingGuard(handler, CustomerLocalAuthGuard) ||
            this.isUsingGuard(classRef, CustomerLocalAuthGuard)

        if (isUsingLocalAuth) {
            return true
        }

        return super.canActivate(context)
    }

    handleRequest(error: any, user: any, _info: any, _context: any) {
        if (error || !user) {
            throw new UnauthorizedException(AuthErrors.Unauthorized)
        }
        return user
    }

    private isUsingGuard(target: any, guardType: any): boolean {
        const guards = this.reflector.get<any[]>(GUARDS_METADATA, target) || []
        return guards.some((guard) => guard === guardType)
    }
}
