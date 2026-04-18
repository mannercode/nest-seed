/**
 * 상품 서비스 컨트롤러.
 *
 * Kong를 통해 /products 경로로 들어온 요청이 이 서비스로 라우팅된다.
 */
import { Controller, Get, Post, Param, Body } from '@nestjs/common'

// 인메모리 데이터 (데모용)
const products = [
    { id: '1', name: '키보드', price: 50000 },
    { id: '2', name: '모니터', price: 300000 },
    { id: '3', name: '마우스', price: 30000 }
]

@Controller('products')
export class ProductsController {
    @Get()
    findAll() {
        return products
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return products.find((p) => p.id === id) ?? { error: 'Product not found' }
    }

    @Post()
    create(@Body() body: { name: string; price: number }) {
        const product = { id: String(products.length + 1), ...body }
        products.push(product)
        return product
    }

    @Get('health')
    health() {
        return { status: 'ok', service: 'products' }
    }
}
