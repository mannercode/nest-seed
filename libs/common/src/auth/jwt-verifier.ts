import { Injectable, Module } from '@nestjs/common'
import { JwtModule, JwtService } from '@nestjs/jwt'

@Injectable()
export class JwtVerifier {
    constructor(private readonly jwtService: JwtService) {}

    verify(
        token: string,
        options: { audience?: string; issuer?: string; secret: string }
    ): Promise<unknown> {
        return this.jwtService.verifyAsync(token, { ...options, algorithms: ['HS256'] })
    }
}

@Module({ imports: [JwtModule.register({})], providers: [JwtVerifier], exports: [JwtVerifier] })
export class JwtVerifierModule {}
