import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    Param,
    Patch,
    Post,
    Query,
    Req,
    UseGuards,
    UsePipes
} from '@nestjs/common'
import { Assert, PaginationOption, PaginationPipe } from 'common'
import { Config } from 'config'
import {
    CreateCustomerDto,
    CustomerDto,
    CustomersService,
    QueryCustomersDto,
    UpdateCustomerDto
} from 'services/customers'
import { CustomerJwtAuthGuard, CustomerLocalAuthGuard, Public } from './guards'

@Controller('customers')
@UseGuards(CustomerJwtAuthGuard)
export class CustomersController {
    constructor(private service: CustomersService) {}

    @Public()
    @Post()
    async createCustomer(@Body() createDto: CreateCustomerDto) {
        return this.service.createCustomer(createDto)
    }

    @Patch(':customerId')
    async updateCustomer(
        @Param('customerId') customerId: string,
        @Body() updateDto: UpdateCustomerDto
    ) {
        return this.service.updateCustomer(customerId, updateDto)
    }

    @Get(':customerId')
    async getCustomer(@Param('customerId') customerId: string) {
        return this.service.getCustomer(customerId)
    }

    @Delete(':customerId')
    async deleteCustomer(@Param('customerId') customerId: string) {
        return this.service.deleteCustomer(customerId)
    }

    @UsePipes(new PaginationPipe(Config.http.paginationDefaultSize))
    @Get()
    async findCustomers(@Query() queryDto: QueryCustomersDto) {
        return this.service.findCustomers(queryDto)
    }

    @UseGuards(CustomerLocalAuthGuard)
    @HttpCode(200)
    @Post('login')
    async login(@Req() req: { user: CustomerDto }) {
        Assert.defined(req.user, 'req.user must be returned in LocalStrategy.validate')

        return this.service.login(req.user.id, req.user.email)
    }

    @Public()
    @HttpCode(200)
    @Post('refresh')
    async refreshToken(@Body('refreshToken') refreshToken: string) {
        return this.service.refreshAuthTokens(refreshToken)
    }
}
