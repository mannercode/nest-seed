import { CreateTicketDto, TicketDto } from 'apps/cores'
import { CommonFixture, createCommonFixture } from '../__helpers__'
import { buildCreateTicketDto } from '../common.fixture'

export const buildCreateTicketDtos = (overrides = {}, length: number) => {
    const createDtos: CreateTicketDto[] = []
    const expectedDtos: TicketDto[] = []

    for (let i = 0; i < length; i++) {
        const { createDto, expectedDto } = buildCreateTicketDto(overrides)

        createDtos.push(createDto)
        expectedDtos.push(expectedDto)
    }

    return { createDtos, expectedDtos }
}

export interface Fixture extends CommonFixture {
    teardown: () => Promise<void>
}

export const createFixture = async () => {
    const commonFixture = await createCommonFixture()

    const teardown = async () => {
        await commonFixture?.close()
    }

    return { ...commonFixture, teardown }
}
