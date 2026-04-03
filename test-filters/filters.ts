import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common'
import { RpcException } from '@nestjs/microservices'

// 테스트용: 어떤 필터가 호출되었는지 기록
export const filterLog: string[] = []

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
    catch(exception: HttpException, host: ArgumentsHost) {
        filterLog.push(`HttpExceptionFilter:${host.getType()}:${exception.constructor.name}`)

        if (host.getType() === 'http') {
            const res = host.switchToHttp().getResponse()
            res.status(exception.getStatus()).json({
                filter: 'HttpExceptionFilter',
                message: exception.message
            })
        }
    }
}

@Catch(RpcException)
export class RpcExceptionFilter implements ExceptionFilter {
    catch(exception: RpcException, host: ArgumentsHost) {
        filterLog.push(`RpcExceptionFilter:${host.getType()}:${exception.constructor.name}`)

        if (host.getType() === 'http') {
            const res = host.switchToHttp().getResponse()
            res.status(500).json({ filter: 'RpcExceptionFilter', message: exception.message })
        }
    }
}

@Catch(Error)
export class ErrorFilter implements ExceptionFilter {
    catch(exception: Error, host: ArgumentsHost) {
        filterLog.push(`ErrorFilter:${host.getType()}:${exception.constructor.name}`)

        if (host.getType() === 'http') {
            const res = host.switchToHttp().getResponse()
            res.status(500).json({ filter: 'ErrorFilter', message: exception.message })
        }
    }
}

@Catch()
export class CatchAllFilter implements ExceptionFilter {
    catch(exception: any, host: ArgumentsHost) {
        const name = exception?.constructor?.name ?? typeof exception
        filterLog.push(`CatchAllFilter:${host.getType()}:${name}`)

        if (host.getType() === 'http') {
            const res = host.switchToHttp().getResponse()
            res.status(500).json({
                filter: 'CatchAllFilter',
                message: exception?.message ?? exception
            })
        }
    }
}
