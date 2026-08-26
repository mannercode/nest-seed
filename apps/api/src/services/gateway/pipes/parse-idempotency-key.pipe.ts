import { IdempotencyErrors } from '@mannercode/common'
import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common'

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._~-]{16,128}$/

@Injectable()
export class ParseIdempotencyKeyPipe implements PipeTransform<unknown, string> {
    transform(value: unknown): string {
        if (value === undefined || value === null || value === '') {
            throw new BadRequestException(IdempotencyErrors.KeyRequired())
        }
        if (typeof value !== 'string' || !IDEMPOTENCY_KEY_PATTERN.test(value)) {
            throw new BadRequestException(IdempotencyErrors.KeyInvalid())
        }
        return value
    }
}
