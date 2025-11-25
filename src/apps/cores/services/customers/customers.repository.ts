import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { MongooseRepository, QueryBuilder, QueryBuilderOptions } from 'common'
import { Model } from 'mongoose'
import { MongooseConfigModule } from 'shared'
import { CreateCustomerDto, SearchCustomersPageDto } from './dtos'
import { Customer } from './models'

@Injectable()
export class CustomersRepository extends MongooseRepository<Customer> {
    constructor(
        @InjectModel(Customer.name, MongooseConfigModule.connectionName) model: Model<Customer>
    ) {
        super(model, MongooseConfigModule.maxTake)
    }

    async create(createDto: CreateCustomerDto) {
        const customer = this.newDocument()
        customer.name = createDto.name
        customer.email = createDto.email
        customer.birthDate = createDto.birthDate
        customer.password = createDto.password

        return customer.save()
    }

    async searchPage(searchDto: SearchCustomersPageDto) {
        const { take, skip, orderby } = searchDto

        const pagination = await this.findWithPagination({
            configureQuery: (queryHelper) => {
                const query = this.buildQuery(searchDto, { allowEmpty: true })

                queryHelper.setQuery(query)
            },
            pagination: { take, skip, orderby }
        })

        return pagination
    }

    async existsByEmail(email: string): Promise<boolean> {
        const result = await this.model.exists({ email: { $eq: email } }).lean()

        // Explicitly converts a value to a boolean
        // 값을 boolean 타입으로 강제 변환
        return !!result
    }

    async findByEmailWithPassword(email: string) {
        const customer = await this.model
            .findOne({ email: { $eq: email } })
            .select('+password')
            .exec()

        return customer
    }

    private buildQuery(searchDto: SearchCustomersPageDto, options: QueryBuilderOptions) {
        const { name, email } = searchDto

        const builder = new QueryBuilder<Customer>()
        builder.addRegex('name', name)
        builder.addRegex('email', email)

        const query = builder.build(options)
        return query
    }
}
