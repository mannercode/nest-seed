import { Controller, Get } from '@nestjs/common'
import { LatLong, LatLongQuery } from 'common'
import { createHttpTestContext, HttpTestClient } from 'testlib'

@Controller()
class TestController {
    @Get('latLong')
    async testLatLong(@LatLongQuery('location') latLong: LatLong) {
        return latLong
    }
}

export type LatLongFixture = { teardown: () => Promise<void>; httpClient: HttpTestClient }

export async function createLatLongFixture() {
    const { httpClient, ...ctx } = await createHttpTestContext({ controllers: [TestController] })

    const teardown = async () => {
        await ctx?.close()
    }

    return { teardown, httpClient }
}
