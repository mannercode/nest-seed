import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { addRegexQuery, MethodLog, MongooseRepository } from 'common'
import { FilterQuery, Model } from 'mongoose'
import { CustomerCreateDto, CustomerQueryDto, CustomerUpdateDto } from './dtos'
import { Customer } from './models'

@Injectable()
export class CustomersRepository extends MongooseRepository<Customer> {
    constructor(@InjectModel(Customer.name, 'mongo') model: Model<Customer>) {
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
        // TODO
        // @Prop({ required: true, select: false })
        // public password!: string;

        // const user = await UserModel.findById(userId).select('+password');
        return this.model.findOne({ email: { $eq: email } })
    }
}
