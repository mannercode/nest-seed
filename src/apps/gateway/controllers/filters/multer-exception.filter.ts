import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common'

export const MulterExceptionFilterErrors = {
    MaxCountExceeded: { code: 'ERR_FILE_UPLOAD_MAX_COUNT_EXCEEDED', message: 'Too many files' },
    MaxSizeExceeded: { code: 'ERR_FILE_UPLOAD_MAX_SIZE_EXCEEDED', message: 'File too large' }
}

//  Exceptions thrown by Multer cannot be modified directly. Therefore, we handle them by adding the code value through an ExceptionFilter.
//  Multer가 발생시키는 예외는 직접 수정할 수 없다. 그래서 ExceptionFilter를 통해 예외에 코드 값을 추가하여 처리한다.
@Catch(HttpException)
export class MulterExceptionFilter implements ExceptionFilter {
    catch(exception: HttpException, _host: ArgumentsHost) {
        let status = exception.getStatus()
        let response = exception.getResponse()

        /* istanbul ignore else */
        if (typeof response === 'object' && 'message' in response) {
            let error = {}

            if (status === 400 && response.message === 'Too many files') {
                error = MulterExceptionFilterErrors.MaxCountExceeded
            } else if (status === 413 && response.message === 'File too large') {
                error = MulterExceptionFilterErrors.MaxSizeExceeded
            }

            // exception.response is a private readonly property, so it’s not ideal to modify it directly.
            // exception.response은 private readonly 속성이라서 직접 수정하는 것이 좋은 방법은 아니다.
            ;(exception as any).response = { ...response, ...error }
        }

        throw exception
    }
}
