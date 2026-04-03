import request from 'supertest'
import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { AppModule } from './app.module'
import {
    CatchAllFilter,
    ErrorFilter,
    filterLog,
    HttpExceptionFilter,
    RpcExceptionFilter
} from './filters'

/**
 * NestJS 필터 선택 알고리즘:
 *   1. 등록 순서 [A, B, C] → 역순 [C, B, A]로 탐색
 *   2. .find()로 첫 번째 매칭만 실행
 *   3. @Catch() (타입 없음) → 무조건 매칭
 *   4. @Catch(Type) → exception instanceof Type
 */

async function createApp(filters: any[]): Promise<INestApplication> {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile()
    const app = module.createNestApplication()
    app.useGlobalFilters(...filters)
    await app.init()
    return app
}

function clearLog() {
    filterLog.length = 0
}

describe('Exception Filter Routing', () => {
    let app: INestApplication

    afterEach(async () => {
        await app?.close()
    })

    /**
     * 시나리오 1: HttpExceptionFilter만 등록
     */
    describe('when only HttpExceptionFilter is registered', () => {
        beforeEach(async () => {
            app = await createApp([new HttpExceptionFilter()])
            clearLog()
        })

        // HttpException을 잡는다
        it('catches HttpException', async () => {
            const res = await request(app.getHttpServer()).get('/throw-http')
            expect(res.body.filter).toBe('HttpExceptionFilter')
            expect(filterLog).toEqual(['HttpExceptionFilter:http:BadRequestException'])
        })

        // plain Error는 못 잡는다 (HttpException이 아니므로)
        it('does NOT catch plain Error', async () => {
            await request(app.getHttpServer()).get('/throw-error')
            expect(filterLog).toEqual([])
        })

        // RpcException은 못 잡는다 (HttpException이 아니므로)
        it('does NOT catch RpcException', async () => {
            await request(app.getHttpServer()).get('/throw-rpc')
            expect(filterLog).toEqual([])
        })
    })

    /**
     * 시나리오 2: ErrorFilter만 등록
     */
    describe('when only ErrorFilter is registered', () => {
        beforeEach(async () => {
            app = await createApp([new ErrorFilter()])
            clearLog()
        })

        // plain Error를 잡는다
        it('catches plain Error', async () => {
            const res = await request(app.getHttpServer()).get('/throw-error')
            expect(res.body.filter).toBe('ErrorFilter')
            expect(filterLog).toEqual(['ErrorFilter:http:Error'])
        })

        // HttpException도 잡는다 (Error의 하위 클래스이므로 instanceof Error === true)
        it('catches HttpException (subclass of Error)', async () => {
            const res = await request(app.getHttpServer()).get('/throw-http')
            expect(res.body.filter).toBe('ErrorFilter')
            expect(filterLog).toEqual(['ErrorFilter:http:BadRequestException'])
        })

        // RpcException도 잡는다 (Error의 하위 클래스)
        it('catches RpcException (subclass of Error)', async () => {
            const res = await request(app.getHttpServer()).get('/throw-rpc')
            expect(res.body.filter).toBe('ErrorFilter')
            expect(filterLog).toEqual(['ErrorFilter:http:RpcException'])
        })

        // string throw는 못 잡는다 (Error 인스턴스가 아님)
        it('does NOT catch string throw', async () => {
            await request(app.getHttpServer()).get('/throw-string')
            expect(filterLog).toEqual([])
        })
    })

    /**
     * 시나리오 3: [HttpExceptionFilter, ErrorFilter] 순서로 등록
     *
     * 역순 탐색: [ErrorFilter, HttpExceptionFilter]
     * HttpException은 Error의 instanceof이므로 ErrorFilter가 먼저 매칭
     */
    describe('when registered as [HttpExceptionFilter, ErrorFilter]', () => {
        beforeEach(async () => {
            app = await createApp([new HttpExceptionFilter(), new ErrorFilter()])
            clearLog()
        })

        // ErrorFilter가 HttpException을 가로챈다 (역순 탐색 + instanceof Error)
        it('routes HttpException to ErrorFilter (last registered, checked first)', async () => {
            const res = await request(app.getHttpServer()).get('/throw-http')
            expect(res.body.filter).toBe('ErrorFilter')
            expect(filterLog).toEqual(['ErrorFilter:http:BadRequestException'])
        })

        // plain Error → ErrorFilter
        it('routes plain Error to ErrorFilter', async () => {
            const res = await request(app.getHttpServer()).get('/throw-error')
            expect(res.body.filter).toBe('ErrorFilter')
            expect(filterLog).toEqual(['ErrorFilter:http:Error'])
        })

        // RpcException → ErrorFilter
        it('routes RpcException to ErrorFilter', async () => {
            const res = await request(app.getHttpServer()).get('/throw-rpc')
            expect(res.body.filter).toBe('ErrorFilter')
            expect(filterLog).toEqual(['ErrorFilter:http:RpcException'])
        })
    })

    /**
     * 시나리오 4: [ErrorFilter, HttpExceptionFilter] 순서로 등록
     *
     * 역순 탐색: [HttpExceptionFilter, ErrorFilter]
     * HttpException → HttpExceptionFilter가 먼저 매칭
     * plain Error → HttpExceptionFilter 안 맞음 → ErrorFilter 매칭
     */
    describe('when registered as [ErrorFilter, HttpExceptionFilter]', () => {
        beforeEach(async () => {
            app = await createApp([new ErrorFilter(), new HttpExceptionFilter()])
            clearLog()
        })

        // HttpExceptionFilter가 먼저 탐색되어 HttpException을 잡는다
        it('routes HttpException to HttpExceptionFilter (last registered, checked first)', async () => {
            const res = await request(app.getHttpServer()).get('/throw-http')
            expect(res.body.filter).toBe('HttpExceptionFilter')
            expect(filterLog).toEqual(['HttpExceptionFilter:http:BadRequestException'])
        })

        // plain Error → HttpExceptionFilter 불일치 → ErrorFilter 매칭
        it('routes plain Error to ErrorFilter', async () => {
            const res = await request(app.getHttpServer()).get('/throw-error')
            expect(res.body.filter).toBe('ErrorFilter')
            expect(filterLog).toEqual(['ErrorFilter:http:Error'])
        })
    })

    /**
     * 시나리오 5: [HttpExceptionFilter, RpcExceptionFilter, ErrorFilter] 등록
     *
     * 역순 탐색: [ErrorFilter, RpcExceptionFilter, HttpExceptionFilter]
     * 모든 Error 하위 → ErrorFilter가 먼저 매칭
     */
    describe('when registered as [HttpExceptionFilter, RpcExceptionFilter, ErrorFilter]', () => {
        beforeEach(async () => {
            app = await createApp([
                new HttpExceptionFilter(),
                new RpcExceptionFilter(),
                new ErrorFilter()
            ])
            clearLog()
        })

        // ErrorFilter가 전부 가로챈다
        it('routes HttpException to ErrorFilter', async () => {
            const res = await request(app.getHttpServer()).get('/throw-http')
            expect(res.body.filter).toBe('ErrorFilter')
        })

        it('routes RpcException to ErrorFilter', async () => {
            const res = await request(app.getHttpServer()).get('/throw-rpc')
            expect(res.body.filter).toBe('ErrorFilter')
        })

        it('routes plain Error to ErrorFilter', async () => {
            const res = await request(app.getHttpServer()).get('/throw-error')
            expect(res.body.filter).toBe('ErrorFilter')
        })
    })

    /**
     * 시나리오 6: [ErrorFilter, RpcExceptionFilter, HttpExceptionFilter] 등록
     *
     * 역순 탐색: [HttpExceptionFilter, RpcExceptionFilter, ErrorFilter]
     * HttpException → HttpExceptionFilter
     * RpcException → RpcExceptionFilter
     * plain Error → ErrorFilter
     */
    describe('when registered as [ErrorFilter, RpcExceptionFilter, HttpExceptionFilter]', () => {
        beforeEach(async () => {
            app = await createApp([
                new ErrorFilter(),
                new RpcExceptionFilter(),
                new HttpExceptionFilter()
            ])
            clearLog()
        })

        it('routes HttpException to HttpExceptionFilter', async () => {
            const res = await request(app.getHttpServer()).get('/throw-http')
            expect(res.body.filter).toBe('HttpExceptionFilter')
        })

        it('routes RpcException to RpcExceptionFilter', async () => {
            const res = await request(app.getHttpServer()).get('/throw-rpc')
            expect(res.body.filter).toBe('RpcExceptionFilter')
        })

        it('routes plain Error to ErrorFilter', async () => {
            const res = await request(app.getHttpServer()).get('/throw-error')
            expect(res.body.filter).toBe('ErrorFilter')
        })

        // string throw는 아무 필터도 못 잡음
        it('does NOT catch string throw', async () => {
            await request(app.getHttpServer()).get('/throw-string')
            expect(filterLog).toEqual([])
        })
    })

    /**
     * 시나리오 7: CatchAllFilter과 다른 필터 조합
     *
     * @Catch()는 exceptionMetatypes가 비어있어 무조건 매칭
     */
    describe('when CatchAllFilter is involved', () => {
        // CatchAllFilter가 마지막(역순 첫 번째)이면 전부 가로챔
        describe('registered as [HttpExceptionFilter, CatchAllFilter]', () => {
            beforeEach(async () => {
                app = await createApp([new HttpExceptionFilter(), new CatchAllFilter()])
                clearLog()
            })

            it('CatchAllFilter catches HttpException', async () => {
                const res = await request(app.getHttpServer()).get('/throw-http')
                expect(res.body.filter).toBe('CatchAllFilter')
            })

            it('CatchAllFilter catches string throw', async () => {
                const res = await request(app.getHttpServer()).get('/throw-string')
                expect(res.body.filter).toBe('CatchAllFilter')
            })
        })

        // CatchAllFilter가 먼저 등록(역순 마지막)이면 구체 필터가 우선
        describe('registered as [CatchAllFilter, HttpExceptionFilter]', () => {
            beforeEach(async () => {
                app = await createApp([new CatchAllFilter(), new HttpExceptionFilter()])
                clearLog()
            })

            it('HttpExceptionFilter catches HttpException', async () => {
                const res = await request(app.getHttpServer()).get('/throw-http')
                expect(res.body.filter).toBe('HttpExceptionFilter')
            })

            it('CatchAllFilter catches plain Error (HttpExceptionFilter 불일치 → CatchAllFilter)', async () => {
                const res = await request(app.getHttpServer()).get('/throw-error')
                expect(res.body.filter).toBe('CatchAllFilter')
            })

            it('CatchAllFilter catches string throw', async () => {
                const res = await request(app.getHttpServer()).get('/throw-string')
                expect(res.body.filter).toBe('CatchAllFilter')
            })
        })
    })
})
