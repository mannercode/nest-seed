import { Module } from '@nestjs/common'
import { CalculatorController } from './calculator.controller.js'

@Module({ controllers: [CalculatorController] })
export class CalculatorModule {}
