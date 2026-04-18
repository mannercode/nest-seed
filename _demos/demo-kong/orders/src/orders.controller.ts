/**
 * 주문 서비스 컨트롤러.
 *
 * Kong의 Key Authentication 플러그인으로 보호되는 서비스.
 * API 키 없이 접근하면 Kong이 401을 반환한다.
 *
 * Kong이 인증을 통과시키면 X-Consumer-Username 헤더에
 * 인증된 소비자 이름을 넣어서 전달한다.
 */
import { Controller, Get, Post, Param, Body, Headers } from '@nestjs/common'

const orders: Array<{ id: string; userId: string; productId: string; quantity: number }> = [
    { id: '1', userId: '1', productId: '2', quantity: 1 },
    { id: '2', userId: '2', productId: '1', quantity: 3 }
]

@Controller('orders')
export class OrdersController {
    @Get()
    findAll(@Headers('x-consumer-username') consumer?: string) {
        // Kong이 인증 통과 후 전달하는 소비자 정보
        return { consumer, orders }
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return orders.find((o) => o.id === id) ?? { error: 'Order not found' }
    }

    @Post()
    create(@Body() body: { userId: string; productId: string; quantity: number }) {
        const order = { id: String(orders.length + 1), ...body }
        orders.push(order)
        return order
    }

    @Get('health')
    health() {
        return { status: 'ok', service: 'orders' }
    }
}
