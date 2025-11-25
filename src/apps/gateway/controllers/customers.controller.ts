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
    async create(@Body() createDto: CreateCustomerDto) {
        return this.customersService.create(createDto)
    }

    @Patch(':customerId')
    async update(@Param('customerId') customerId: string, @Body() updateDto: UpdateCustomerDto) {
        return this.customersService.update(customerId, updateDto)
    }

    @Get('jwtGuard')
    async testJwtGuard() {
        return { message: 'accessToken is valid' }
    }

    @Get(':customerId')
    async get(@Param('customerId') customerId: string) {
        const customers = await this.customersService.getMany([customerId])
        return customers[0]
    }

    @Delete(':customerId')
    async delete(@Param('customerId') customerId: string) {
        return this.customersService.deleteMany([customerId])
    }

    @Get()
    async searchPage(@Query() searchDto: SearchCustomersPageDto) {
        return this.customersService.searchPage(searchDto)
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
