import { INestMicroservice } from '@nestjs/common'
import {
    ClientProxy,
    ClientProxyFactory,
    MicroserviceOptions,
    Transport
} from '@nestjs/microservices'
import { Test, TestingModule } from '@nestjs/testing'
import { lastValueFrom } from 'rxjs'
import { HttpToRpcExceptionFilter } from '../http-to-rpc-exception.filter'
import { SampleModule } from './http-to-rpc-exception.filter.fixture'

describe('HttpToRpcExceptionFilter', () => {
    let client: ClientProxy
    let module: TestingModule
    let app: INestMicroservice

    beforeEach(async () => {
        const builder = Test.createTestingModule({
            imports: [SampleModule]
        })
        module = await builder.compile()

        const rpcOptions = {
            transport: Transport.TCP,
            options: { host: '0.0.0.0', port: 3000 }
        } as const

        app = module.createNestMicroservice<MicroserviceOptions>(rpcOptions)

        app.useGlobalFilters(new HttpToRpcExceptionFilter())
        await app.listen()

        client = ClientProxyFactory.create(rpcOptions)
        await client.connect()
    })

    afterEach(async () => {
        await client.close()
        await module.close()
        await app.close()
    })

    it('should handle HttpException properly for RPC', async () => {
        const res = lastValueFrom(client.send({ cmd: 'throwHttpException' }, {}))
        await expect(res).rejects.toMatchObject({ status: 404, message: expect.any(String) })
    })

    it('should handle Error properly for RPC', async () => {
        const res = lastValueFrom(client.send({ cmd: 'throwError' }, {}))
        await expect(res).rejects.toMatchObject({ status: 500, message: expect.any(String) })
    })

    it('should validate input and return error for incorrect data format', async () => {
        const res = lastValueFrom(client.send({ cmd: 'createSample' }, { wrong: 'wrong field' }))
        await expect(res).rejects.toMatchObject({ status: 400, message: expect.any(String) })
    })
})
