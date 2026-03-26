import { HttpTestClient } from '@mannercode/testing'
import { createHttpTestContext } from '@mannercode/testing'
import { Controller, Get } from '@nestjs/common'
import { LatLong } from '../lat-long'
import { ParseLatLongQuery } from '../lat-long'

export type LatLongFixture = { httpClient: HttpTestClient; teardown: () => Promise<void> }

@Controller()
class TestController {
    @Get('latLong')
    async testLatLong(@ParseLatLongQuery('location') latLong: LatLong) {
        return latLong
    }
}

export async function createLatLongFixture() {
    const { httpClient, ...ctx } = await createHttpTestContext({ controllers: [TestController] })

    const teardown = async () => {
        await ctx.close()
    }

    return { httpClient, teardown }
}
