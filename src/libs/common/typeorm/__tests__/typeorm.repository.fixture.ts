import { Injectable, Module } from '@nestjs/common'
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm'
import { TypeormEntity, TypeormRepository, padNumber } from 'common'
import { Column, Entity, Repository } from 'typeorm'

@Entity()
export class Sample extends TypeormEntity {
    @Column()
    name: string
}

@Injectable()
export class SamplesRepository extends TypeormRepository<Sample> {
    constructor(@InjectRepository(Sample) repo: Repository<Sample>) {
        super(repo)
    }
}

@Module({
    imports: [TypeOrmModule.forFeature([Sample])],
    providers: [SamplesRepository]
})
export class SamplesModule {}

export async function createSamples(
    repository: SamplesRepository,
    count: number
): Promise<Sample[]> {
    const promises = []

    for (let i = 0; i < count; i++) {
        const promise = repository.create({
            name: `Sample-${padNumber(i, 3)}`
        })

        promises.push(promise)
    }

    const samples = await Promise.all(promises)

    return samples
}

export function sortByName(samples: Sample[]) {
    return samples.sort((a, b) => a.name.localeCompare(b.name))
}

export function sortByNameDescending(samples: Sample[]) {
    return samples.sort((a, b) => b.name.localeCompare(a.name))
}

export const baseFields = {
    id: expect.anything(),
    createdAt: expect.anything(),
    updatedAt: expect.anything(),
    version: expect.anything()
}
