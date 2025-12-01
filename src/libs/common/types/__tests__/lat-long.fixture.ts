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
    const { httpClient, ...testContext } = await createHttpTestContext({
        metadata: { controllers: [TestController] }
    })

    async function teardown() {
        await testContext?.close()
    }

    return { teardown, httpClient }
}
