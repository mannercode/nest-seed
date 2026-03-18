import { QueryBuilderOptions } from '@mannercode/nestlib-common'
import { assignIfDefined, MongooseRepository, QueryBuilder } from '@mannercode/nestlib-common'
import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { MongooseConfigModule } from 'shared'
import { CreateCustomerDto, SearchCustomersPageDto, UpdateCustomerDto } from './dtos'
import { Customer } from './models'

@Injectable()
export class CustomersRepository extends MongooseRepository<Customer> {
    constructor(
        @InjectModel(Customer.name, MongooseConfigModule.connectionName)
        readonly model: Model<Customer>
    ) {
        super(model, MongooseConfigModule.maxTake)
    }

    async create(createDto: CreateCustomerDto) {
        const customer = this.newDocument()
        customer.name = createDto.name
        customer.email = createDto.email
        customer.birthDate = createDto.birthDate
        customer.password = createDto.password

        await customer.save()

        return customer.toJSON()
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
            .lean({ virtuals: true })
            .exec()

        return customer
    }

    async searchPage(searchDto: SearchCustomersPageDto) {
        const { orderby, page, limit } = searchDto

        const pagination = await this.findWithPagination({
            configureQuery: async (queryHelper) => {
                const query = this.buildQuery(searchDto, { allowEmpty: true })

                queryHelper.setQuery(query)
            },
            pagination: { orderby, page, limit }
        })

        return pagination
    }

    async update(customerId: string, updateDto: UpdateCustomerDto) {
        const customer = await this.getDocumentById(customerId)

        assignIfDefined(customer, updateDto, 'name')
        assignIfDefined(customer, updateDto, 'email')
        assignIfDefined(customer, updateDto, 'birthDate')

        await customer.save()

        return customer.toJSON()
    }

    private buildQuery(searchDto: SearchCustomersPageDto, options: QueryBuilderOptions) {
        const { email, name } = searchDto

        const builder = new QueryBuilder<Customer>()
        builder.addRegex('name', name)
        builder.addRegex('email', email)

        const query = builder.build(options)
        return query
    }
}
