import { Require } from '@mannercode/common'
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
    CustomersService,
    SearchCustomersPageDto,
    UpdateCustomerDto
} from 'cores'
import { CustomerJwtAuthGuard, CustomerLocalAuthGuard, Public } from './guards'
import { CustomerAuthRequest } from './types'

@Controller('customers')
@UseGuards(CustomerJwtAuthGuard)
export class CustomersHttpController {
    constructor(private readonly customersService: CustomersService) {}

    @Post()
    @Public()
    async create(@Body() createDto: CreateCustomerDto) {
        return this.customersService.create(createDto)
    }

    @Delete(':customerId')
    @HttpCode(HttpStatus.NO_CONTENT)
    async delete(@Param('customerId') customerId: string) {
        await this.customersService.deleteMany([customerId])
    }

    @HttpCode(HttpStatus.OK)
    @Post('login')
    @UseGuards(CustomerLocalAuthGuard)
    async login(@Req() req: CustomerAuthRequest) {
        Require.defined(req.user, 'req.user must be returned in LocalStrategy.validate')

        return this.customersService.generateAuthTokens(req.user)
    }

    @HttpCode(HttpStatus.OK)
    @Post('refresh')
    @Public()
    async refreshToken(@Body('refreshToken') refreshToken: string) {
        return this.customersService.refreshAuthTokens(refreshToken)
    }

    @Get()
    async searchPage(@Query() searchDto: SearchCustomersPageDto) {
        return this.customersService.searchPage(searchDto)
    }

    @Get(':customerId')
    async get(@Param('customerId') customerId: string) {
        const [customer] = await this.customersService.getMany([customerId])
        return customer
    }

    @Patch(':customerId')
    async update(@Param('customerId') customerId: string, @Body() updateDto: UpdateCustomerDto) {
        return this.customersService.update(customerId, updateDto)
    }
}
