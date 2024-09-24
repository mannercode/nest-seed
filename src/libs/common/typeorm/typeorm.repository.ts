import { Assert, PaginationOption, PaginationResult } from 'common'
import { DeepPartial, FindOptionsWhere, In, Repository, SelectQueryBuilder } from 'typeorm'
import { TypeormEntity } from '.'
import { EntityNotFoundTypeormException, ParameterTypeormException } from './exceptions'

const DEFAULT_TAKE_SIZE = 100

export abstract class TypeormRepository<Entity extends TypeormEntity> {
    constructor(protected repo: Repository<Entity>) {}

    async create(entityData: DeepPartial<Entity>): Promise<Entity> {
        Assert.undefined(entityData.id, `The id ${entityData.id} should not be defined.`)

        // When repo.save(creationData) is called, an id is automatically generated and added to creationData, modifying it.
        const cloned = { ...entityData }
        const savedEntity = await this.repo.save(cloned)

        return savedEntity
    }

    async update(id: string, query: DeepPartial<Entity>): Promise<Entity> {
        const entity = await this.repo.findOne({
            where: { id } as unknown as FindOptionsWhere<Entity>
        })

        if (entity) {
            this.repo.merge(entity, query)

            const saved = await this.repo.save(entity)

            Assert.equals(saved, entity, 'Update request and result are different')

            return saved
        }

        throw new EntityNotFoundTypeormException(
            `Failed to update entity with id: ${id}. Entity not found.`
        )
    }

    async deleteById(id: string): Promise<void> {
        const result = await this.repo.delete(id)

        if (result.affected === 0) {
            throw new EntityNotFoundTypeormException(
                `Failed to delete entity with id: ${id}. Entity not found.`
            )
        }

        Assert.truthy(result.affected === 1, 'Affected must be 1')
    }

    async existsById(id: string): Promise<boolean> {
        return this.repo.exists({
            where: { id } as unknown as FindOptionsWhere<Entity>
        })
    }

    async findById(id: string): Promise<Entity | null> {
        return this.repo.findOne({
            where: { id } as unknown as FindOptionsWhere<Entity>
        })
    }

    async findByIds(ids: string[]): Promise<Entity[]> {
        return this.repo.findBy({
            id: In(ids)
        } as unknown as FindOptionsWhere<Entity>)
    }

    async findByFilter(filter: Record<string, any>): Promise<Entity[]> {
        const qb = this.repo.createQueryBuilder('entity')

        Object.entries(filter).forEach(([key, value]) => {
            if (value !== undefined) {
                qb.andWhere(`entity.${key} = :${key}`, { [key]: value })
            }
        })

        const entities = await qb.getMany()

        return entities
    }

    async findWithPagination(
        pagination: PaginationOption,
        queryCustomizer?: (qb: SelectQueryBuilder<Entity>) => void
    ): Promise<PaginationResult<Entity>> {
        const take = pagination.take ?? DEFAULT_TAKE_SIZE
        const skip = pagination.skip ?? 0
        const { orderby } = pagination

        if (!take) {
            throw new ParameterTypeormException('The ‘take’ parameter is required for pagination.')
        }

        const qb = this.repo.createQueryBuilder('entity')

        qb.skip(skip)
        qb.take(take)

        if (orderby) {
            const order = orderby.direction.toLowerCase() === 'desc' ? 'DESC' : 'ASC'

            qb.orderBy(`entity.${orderby.name}`, order)
        }

        queryCustomizer && queryCustomizer(qb)

        const [items, total] = await qb.getManyAndCount()

        return { skip, take, total, items }
    }
}
