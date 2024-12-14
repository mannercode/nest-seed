import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { addRegexQuery, MethodLog, MongooseRepository, objectId } from 'common'
import { MongooseConfig } from 'config'
import { FilterQuery, Model } from 'mongoose'
import { CustomerCreateDto, CustomerQueryDto, CustomerUpdateDto } from './dtos'
import { Customer } from './models'

@Injectable()
export class CustomersRepository extends MongooseRepository<Customer> {
    constructor(@InjectModel(Customer.name, MongooseConfig.connName) model: Model<Customer>) {
        super(model)
    }

    @MethodLog()
    async createCustomer(createDto: CustomerCreateDto) {
        const customer = this.newDocument()
        customer.name = createDto.name
        customer.email = createDto.email
        customer.birthdate = createDto.birthdate
        customer.password = createDto.password

        return customer.save()
    }

    @MethodLog()
    async updateCustomer(customerId: string, updateDto: CustomerUpdateDto) {
        const customer = await this.getById(customerId)
        if (updateDto.name) customer.name = updateDto.name
        if (updateDto.email) customer.email = updateDto.email
        if (updateDto.birthdate) customer.birthdate = updateDto.birthdate

        return customer.save()
    }

    @MethodLog({ level: 'verbose' })
    async findCustomers(queryDto: CustomerQueryDto) {
        const { name, email, ...pagination } = queryDto

        const paginated = await this.findWithPagination({
            callback: (helpers) => {
                const query: FilterQuery<Customer> = {}
                addRegexQuery(query, 'name', name)
                addRegexQuery(query, 'email', email)

                helpers.setQuery(query)
            },
            pagination
        })

        return paginated
    }

    @MethodLog({ level: 'verbose' })
    async findByEmail(email: string) {
        return this.model.findOne({ email: { $eq: email } })
    }

    @MethodLog({ level: 'verbose' })
    async getPassword(customerId: string) {
        const customer = await this.model.findById(objectId(customerId)).select('+password').exec()

        /* istanbul ignore if */
        if (!customer) {
            throw new NotFoundException({
                code: 'ERR_CUSTOMER_NOT_FOUND',
                message: 'Customer not found.',
                customerId
            })
        }

        return customer.password
    }
}
