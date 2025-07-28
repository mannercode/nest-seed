import { CreateTicketDto } from 'apps/cores'
import { buildCreateTicketDto } from '../__fixtures__'
import { CommonFixture, createCommonFixture } from '../__helpers__'

export const buildCreateTicketDtos = (overrides = {}, length: number) => {
    const createDtos: CreateTicketDto[] = []

    for (let i = 0; i < length; i++) {
        const createDto = buildCreateTicketDto(overrides)

        createDtos.push(createDto)
    }

    return createDtos
}

export interface Fixture extends CommonFixture {
    teardown: () => Promise<void>
}

export const createFixture = async () => {
    const fix = await createCommonFixture()

    const teardown = async () => {
        await fix?.close()
    }

    return { ...fix, teardown }
}
