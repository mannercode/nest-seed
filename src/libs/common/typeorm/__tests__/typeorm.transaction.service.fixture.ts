import { Injectable, Module } from '@nestjs/common'
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm'
import { TypeormEntity, TypeormRepository, TypeormTransactionService } from 'common'
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
    providers: [SamplesRepository, TypeormTransactionService]
})
export class SamplesModule {}
