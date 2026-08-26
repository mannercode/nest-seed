import { createParamDecorator, type ExecutionContext } from '@nestjs/common'

export const IdempotencyKey = createParamDecorator(
    (_data: unknown, context: ExecutionContext): unknown => {
        const request = context.switchToHttp().getRequest<{ headers: Record<string, unknown> }>()
        return request.headers['idempotency-key']
    }
)
