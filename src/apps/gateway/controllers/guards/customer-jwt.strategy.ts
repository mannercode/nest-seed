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

    validate(payload: CustomerAuthPayload): CustomerAuthPayload | null {
        /**
         * You can control it in the middle as follows
         * 아래처럼 중간에서 제어할 수 있다
         *
         * const exists = await this.service.customersExist([payload.customerId])
         * return exists ? payload : null
         */
        return payload
    }
}
