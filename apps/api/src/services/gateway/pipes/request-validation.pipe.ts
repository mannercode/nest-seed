import { BadRequestException, Injectable, StandardSchemaValidationPipe } from '@nestjs/common'

export const RequestValidationPipeErrors = {
    Failed: (
        details: Array<{ constraints: Record<string, string> | undefined; field: string }>
    ) => ({ code: 'ERR_REQUEST_VALIDATION_FAILED', message: 'Validation failed', details })
}

@Injectable()
export class RequestValidationPipe extends StandardSchemaValidationPipe {
    constructor() {
        super({
            exceptionFactory: (errors) =>
                new BadRequestException(
                    RequestValidationPipeErrors.Failed(
                        errors.flatMap((error) => {
                            const path = (error.path ?? []).map(String)
                            const keys =
                                'keys' in error && Array.isArray(error.keys) ? error.keys : []
                            const fields =
                                keys.length > 0
                                    ? keys.map((key) => [...path, String(key)].join('.'))
                                    : [path.join('.')]

                            return fields.map((field) => ({
                                constraints: { validation: error.message },
                                field
                            }))
                        })
                    )
                ),
            transform: true
        })
    }
}
