import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { QueryOrderDto } from './dto/query-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { UpdatePickupDateDto } from './dto/update-pickup-date.dto';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  /** POST /api/orders - customer memesan menu untuk tanggal pengambilan tertentu. */
  @Post()
  create(@Body() dto: CreateOrderDto) {
    return this.ordersService.create(dto);
  }

  /** GET /api/orders?status=PENDING&pickupDate=2026-09-20 - dipakai dashboard admin. */
  @Get()
  findAll(@Query() query: QueryOrderDto) {
    return this.ordersService.findAll(query);
  }

  /** GET /api/orders/user/:userId - history order milik satu customer. */
  @Get('user/:userId')
  findByUser(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() query: QueryOrderDto,
  ) {
    return this.ordersService.findByUser(userId, query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.ordersService.findOne(id);
  }

  /** PATCH /api/orders/:id/pickup-date - customer mengganti waktu pengambilan. */
  @Patch(':id/pickup-date')
  updatePickupDate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePickupDateDto,
  ) {
    return this.ordersService.updatePickupDate(id, dto);
  }

  /** PATCH /api/orders/:id/status - admin mengatur status orderan. */
  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateStatus(id, dto);
  }

  /** PATCH /api/orders/:id/cancel - customer membatalkan ordernya. */
  @Patch(':id/cancel')
  cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.ordersService.cancel(id);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.ordersService.remove(id);
  }
}
