import { Controller, Get } from '@nestjs/common'
import { LatLong } from 'common'
import { ParseLatLongQuery } from 'common'
import { HttpTestClient } from 'testlib'
import { createHttpTestContext } from 'testlib'

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
