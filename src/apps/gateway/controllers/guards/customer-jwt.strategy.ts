import { Injectable } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { CustomerAuthPayload } from 'apps/cores'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { AppConfigService } from 'shared'

@Injectable()
export class CustomerJwtStrategy extends PassportStrategy(Strategy, 'customer-jwt') {
    constructor(readonly config: AppConfigService) {
        super({
            ignoreExpiration: false,
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            secretOrKey: config.auth.accessSecret
        })
    }

    /**
     * @example
     *
     * You can extend it as shown below to verify whether the customer exists.
     * 고객 존재 여부를 확인하려면 아래처럼 확장할 수 있다.
     *
     * async validate(payload: CustomerAuthPayload) {
     *     const exists = await this.service.customersExist([payload.customerId])
     *     return exists ? payload : null
     * }
     */
    validate(payload: CustomerAuthPayload): CustomerAuthPayload {
        return payload
    }
}
