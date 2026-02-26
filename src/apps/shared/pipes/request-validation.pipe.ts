import { BadRequestException, ValidationPipe } from '@nestjs/common'

export const RequestValidationPipeErrors = {
    Failed: (
        details: Array<{ constraints: Record<string, string> | undefined; field: string }>
    ) => ({ code: 'ERR_REQUEST_VALIDATION_FAILED', message: 'Validation failed', details })
}

export class RequestValidationPipe extends ValidationPipe {
    constructor() {
        super({
            disableErrorMessages: false,
            enableDebugMessages: false,
            exceptionFactory: (errors) =>
                new BadRequestException(
                    RequestValidationPipeErrors.Failed(
                        errors.map((error) => ({
                            constraints: error.constraints,
                            field: error.property
                        }))
                    )
                ),
            forbidNonWhitelisted: true,
            forbidUnknownValues: true,
            skipMissingProperties: false,
            transform: true,
            transformOptions: { enableImplicitConversion: true },
            whitelist: true
        })
    }
}
