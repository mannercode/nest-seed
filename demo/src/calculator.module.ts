import { Module } from '@nestjs/common'
import { CalculatorController } from './calculator.controller.js'

// Nest는 Module의 metadata를 읽어 생성하고 등록해야 할 controller를 찾는다.
// 이 데모에는 provider가 없으므로 calculator controller 하나만 등록한다.
@Module({ controllers: [CalculatorController] })
export class CalculatorModule {}
