import {
    CallHandler,
    ExecutionContext,
    HttpException,
    Injectable,
    NestInterceptor
} from '@nestjs/common'
import { Observable, catchError, throwError } from 'rxjs'

@Injectable()
export class RpcToHttpExceptionInterceptor implements NestInterceptor {
    intercept(_context: ExecutionContext, next: CallHandler): Observable<any> {
        return next.handle().pipe(
            catchError((err) => {
                if (err && err.status && err.response) {
                    return throwError(() => new HttpException(err.response, err.status))
                }
                /* istanbul ignore next */
                return throwError(() => err)
            })
        )
    }
}
