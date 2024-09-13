import { ExecutionContext, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { AuthGuard } from '@nestjs/passport'
import { Observable } from 'rxjs'
import { CustomerLocalAuthGuard } from './customer-local-auth.guard'
import { IS_PUBLIC_KEY } from './public.decorator'

@Injectable()
export class CustomerJwtAuthGuard extends AuthGuard('customer-jwt') {
    constructor(private reflector: Reflector) {
        super()
    }

    canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
        const isIgnore = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass()
        ])

        if (isIgnore) {
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

    private isUsingGuard(target: any, guardType: any): boolean {
        const guards = this.reflector.get<any[]>('__guards__', target) || []
        return guards.some((guard) => guard === guardType)
    }
}
