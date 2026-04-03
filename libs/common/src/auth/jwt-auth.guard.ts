import { CanActivate, ExecutionContext } from '@nestjs/common'
import { Injectable, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import { IS_PUBLIC_KEY } from './public.decorator'

export type JwtAuthGuardOptions = { secret: string }

@Injectable()
export abstract class JwtAuthGuard implements CanActivate {
    constructor(
        protected readonly jwtService: JwtService,
        protected readonly reflector: Reflector,
        protected readonly options: JwtAuthGuardOptions
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        if (this.isPublicRoute(context)) {
            return true
        }

        if (this.isUsingLocalAuth(context)) {
            return true
        }

        const request = context.switchToHttp().getRequest()
        const token = this.extractBearerToken(request)

        if (!token) {
            throw new UnauthorizedException()
        }

        try {
            const payload = await this.jwtService.verifyAsync(token, {
                secret: this.options.secret
            })
            request.user = payload
        } catch {
            throw new UnauthorizedException()
        }

        return true
    }

    protected isPublicRoute(context: ExecutionContext): boolean {
        return this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass()
        ])
    }

    protected isUsingLocalAuth(_context: ExecutionContext): boolean {
        return false
    }

    private extractBearerToken(request: any): string | undefined {
        const authorization = request.headers?.authorization
        if (!authorization) return undefined

        const [type, token] = authorization.split(' ')
        return type === 'Bearer' ? token : undefined
    }
}

@Injectable()
export abstract class OptionalJwtAuthGuard extends JwtAuthGuard {
    async canActivate(context: ExecutionContext): Promise<boolean> {
        if (this.isPublicRoute(context)) {
            return true
        }

        const request = context.switchToHttp().getRequest()
        const token = this.extractOptionalBearerToken(request)

        if (!token) {
            request.user = null
            return true
        }

        try {
            const payload = await this.jwtService.verifyAsync(token, {
                secret: this.options.secret
            })
            request.user = payload
        } catch {
            request.user = null
        }

        return true
    }

    private extractOptionalBearerToken(request: any): string | undefined {
        const authorization = request.headers?.authorization
        if (!authorization) return undefined

        const [type, token] = authorization.split(' ')
        return type === 'Bearer' ? token : undefined
    }
}
