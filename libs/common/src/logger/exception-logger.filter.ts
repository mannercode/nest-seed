import { ArgumentsHost, Catch, HttpException, Logger } from '@nestjs/common'
import { BaseExceptionFilter } from '@nestjs/core'
import { Request } from 'express'
import { defaultTo } from '../utils'
import { HttpErrorLog } from './types'

/**
 * NestJS 예외 필터 선택 알고리즘 (내부 구현, 공식 문서 아님):
 *   - 등록 배열을 역순(.reverse())으로 탐색
 *   - .find()로 첫 번째 매칭 필터만 실행
 *   - @Catch() (타입 없음) → 무조건 매칭
 *   - @Catch(Type) → exception instanceof Type
 *
 * 내부 구현이므로 버전에 따라 바뀔 수 있다.
 * 등록 순서에 의존하지 않도록 상속으로 필터를 확장한다.
 *
 * HTTP 전용 예외 로거. RPC가 필요하면 @mannercode/microservices의
 * RpcExceptionLoggerFilter를 사용한다.
 *
 * 전역 필터를 추가해야 한다면 HttpExceptionLoggerFilter를 상속 후 super.catch()를 호출한다.
 *
 * class CustomFilter extends HttpExceptionLoggerFilter {
 *     catch(exception: Error, host: ArgumentsHost) {
 *         ...
 *         super.catch(exception, host)
 *     }
 * }
 */
@Catch(Error)
export class HttpExceptionLoggerFilter extends BaseExceptionFilter {
    catch(exception: Error, host: ArgumentsHost) {
        const contextType = host.getType()

        if (contextType === 'http') {
            this.logHttp(exception, host)
        } else {
            Logger.error('unknown context type', { contextType, message: exception.message })
        }

        super.catch(exception, host)
    }

    protected logHttp(exception: Error, host: ArgumentsHost) {
        const httpContext = host.switchToHttp()
        const request = httpContext.getRequest<Request>()
        const { body, method, url } = request
        const httpLogBase = {
            contextType: 'http' as const,
            duration: `${Date.now() - (request as any)._startTimestamp}ms`,
            request: { body, method, url }
        }

        if (exception instanceof HttpException) {
            const errorLog = {
                ...httpLogBase,
                response: exception.getResponse(),
                stack: defaultTo(exception.stack, '').split('\n'),
                statusCode: exception.getStatus()
            } as HttpErrorLog

            Logger.warn('fail', errorLog)
        } else {
            const errorLog = {
                ...httpLogBase,
                response: { message: exception.message },
                stack: defaultTo(exception.stack, '').split('\n'),
                statusCode: 500
            } as HttpErrorLog

            Logger.error('error', errorLog)
        }
    }
}
