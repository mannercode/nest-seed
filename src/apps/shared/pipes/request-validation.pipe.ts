import { BadRequestException, ValidationPipe } from '@nestjs/common'

export const RequestValidationPipeErrors = {
    Failed: { code: 'ERR_REQUEST_VALIDATION_FAILED', message: 'Validation failed' }
}

export class RequestValidationPipe extends ValidationPipe {
    constructor() {
        super({
            exceptionFactory: (errors) =>
                new BadRequestException({
                    ...RequestValidationPipeErrors.Failed,
                    details: errors.map((error) => ({
                        field: error.property,
                        constraints: error.constraints
                    }))
                }),
            enableDebugMessages: false,
            disableErrorMessages: false,
            whitelist: true,
            forbidNonWhitelisted: true,
            skipMissingProperties: false,
            forbidUnknownValues: true,
            transform: true,
            transformOptions: { enableImplicitConversion: true }
        })
    }
}
