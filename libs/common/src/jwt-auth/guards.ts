import { CanActivate, ExecutionContext } from '@nestjs/common'
import { Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import { defaultTo } from '../utils'

export const IS_PUBLIC_KEY = 'isPublic'
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true)

export type JwtAuthGuardOptions = { secret: string }

export type LocalAuthGuardOptions = {
    passwordField?: string
    usernameField?: string
    validate: (username: string, password: string) => Promise<object | null>
}

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

    protected isUsingLocalAuth(context: ExecutionContext): boolean {
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

@Injectable()
export abstract class LocalAuthGuard implements CanActivate {
    constructor(protected readonly options: LocalAuthGuardOptions) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest()
        const usernameField = defaultTo(this.options.usernameField, 'username')
        const passwordField = defaultTo(this.options.passwordField, 'password')

        const username = request.body?.[usernameField]
        const password = request.body?.[passwordField]

        if (!username || !password) {
            throw new UnauthorizedException()
        }

        const user = await this.options.validate(username, password)

        if (!user) {
            throw new UnauthorizedException()
        }

        request.user = user
        return true
    }
}
