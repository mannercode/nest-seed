import { Injectable } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { AuthTokenPayload } from 'common'
import { AppConfigService } from 'config'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { CustomersService } from 'services/customers'

@Injectable()
export class CustomerJwtStrategy extends PassportStrategy(Strategy, 'customer-jwt') {
    constructor(
        private service: CustomersService,
        config: AppConfigService
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: config.customerAuth.accessSecret
        })
    }

    async validate(payload: AuthTokenPayload): Promise<AuthTokenPayload | null> {
        const exists = await this.service.customersExist([payload.userId])
        return exists ? payload : null
    }
}
