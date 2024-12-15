import { ArgumentsHost, Catch, HttpException, RpcExceptionFilter } from '@nestjs/common'
import { Observable, throwError } from 'rxjs'

@Catch()
export class HttpToRpcExceptionFilter implements RpcExceptionFilter<any> {
    catch(exception: any, _host: ArgumentsHost): Observable<any> {
        let error = exception

        if (exception instanceof HttpException) {
            error = { status: exception.getStatus(), message: exception.message }
        } else {
            /* istanbul ignore next */
            error = { status: 500, message: exception.message ?? 'Internal server error' }
        }

        return throwError(() => error)
    }
}
