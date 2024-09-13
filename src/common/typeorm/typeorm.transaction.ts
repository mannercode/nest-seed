import { ClassConstructor } from 'class-transformer'
import { Assert, TransactionTypeormException } from 'common'
import { DeepPartial, QueryRunner } from 'typeorm'
import { TypeormEntity } from '.'

export class TypeormTransaction {
    private rollbackRequested: boolean

    constructor(private queryRunner: QueryRunner) {
        this.rollbackRequested = false
    }

    rollback() {
        this.rollbackRequested = true
    }

    isRollbackRequested() {
        return this.rollbackRequested
    }
    async create<Entity extends TypeormEntity>(
        resourceType: ClassConstructor<Entity>,
        entityData: DeepPartial<Entity>
    ): Promise<Entity> {
        Assert.falsy(this.rollbackRequested, 'rollback() has been executed')

        this.ensureTransactionIsActive()

        const entity = this.queryRunner.manager.create(resourceType, entityData)

        return this.queryRunner.manager.save(entity)
    }

    async update<Entity extends TypeormEntity>(entity: Entity): Promise<Entity> {
        Assert.falsy(this.rollbackRequested, 'rollback() has been executed')
        Assert.defined(entity.id, "Entity doesn't have id")

        this.ensureTransactionIsActive()

        return this.queryRunner.manager.save(entity)
    }

    async delete<Entity extends TypeormEntity>(entity: Entity): Promise<void> {
        Assert.falsy(this.rollbackRequested, 'rollback() has been executed')

        this.ensureTransactionIsActive()

        await this.queryRunner.manager.remove(entity)
    }

    ensureTransactionIsActive() {
        /* istanbul ignore if */
        if (!this.queryRunner.isTransactionActive) {
            throw new TransactionTypeormException('Transaction is not active')
        }
    }
}
