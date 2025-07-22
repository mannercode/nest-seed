import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Patch,
    Post,
    Query,
    Req,
    UseGuards
} from '@nestjs/common'
import {
    CreateCustomerDto,
    CustomersClient,
    SearchCustomersPageDto,
    UpdateCustomerDto
} from 'apps/cores'
import { Assert } from 'common'
import { CustomerJwtAuthGuard, CustomerLocalAuthGuard, Public } from './guards'
import { CustomerAuthRequest } from './types'

@UseGuards(CustomerJwtAuthGuard)
@Controller('customers')
export class CustomersController {
    constructor(private customersService: CustomersClient) {}

    @Public()
    @Post()
    async createCustomer(@Body() createDto: CreateCustomerDto) {
        return this.customersService.createCustomer(createDto)
    }

    @Patch(':customerId')
    async updateCustomer(
        @Param('customerId') customerId: string,
        @Body() updateDto: UpdateCustomerDto
    ) {
        return this.customersService.updateCustomer(customerId, updateDto)
    }

    @Get('jwtGuard')
    async testJwtGuard() {
        return { message: 'accessToken is valid' }
    }

    @Get(':customerId')
    async getCustomer(@Param('customerId') customerId: string) {
        const customers = await this.customersService.getCustomers([customerId])
        return customers[0]
    }

    @Delete(':customerId')
    async deleteCustomer(@Param('customerId') customerId: string) {
        return this.customersService.deleteCustomers([customerId])
    }

    @Get()
    async searchCustomersPage(@Query() searchDto: SearchCustomersPageDto) {
        return this.customersService.searchCustomersPage(searchDto)
    }

    @UseGuards(CustomerLocalAuthGuard)
    @HttpCode(HttpStatus.OK)
    @Post('login')
    async login(@Req() req: CustomerAuthRequest) {
        Assert.defined(req.user, 'req.user must be returned in LocalStrategy.validate')

        return this.customersService.generateAuthTokens(req.user)
    }

    @Public()
    @HttpCode(HttpStatus.OK)
    @Post('refresh')
    async refreshToken(@Body('refreshToken') refreshToken: string) {
        return this.customersService.refreshAuthTokens(refreshToken)
    }
}
