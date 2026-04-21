import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { UpdateTransactionStageDto } from './dto/update-transaction-stage.dto';
import type { PaginatedResult } from './interfaces/paginated-result.interface';
import { TransactionDocument } from './schemas/transaction.schema';
import { TransactionsService } from './transactions.service';
import {
  buildExportFilename,
  buildTransactionExport,
} from './utils/transaction-export';

@Controller('transactions')
@UseGuards(JwtAuthGuard)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  create(@Body() dto: CreateTransactionDto): Promise<TransactionDocument> {
    return this.transactionsService.create(dto);
  }

  @Get()
  findAll(
    @Query() query: PaginationQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaginatedResult<TransactionDocument>> {
    return this.transactionsService.findAllPaginated(query, user);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TransactionDocument> {
    return this.transactionsService.findOne(id, user);
  }

  @Patch(':id/stage')
  updateStage(
    @Param('id') id: string,
    @Body() dto: UpdateTransactionStageDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TransactionDocument> {
    return this.transactionsService.updateStage(id, dto, user);
  }

  @Get(':id/export')
  @Header('Content-Type', 'text/plain; charset=utf-8')
  async exportOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    const transaction = await this.transactionsService.findOne(id, user);
    const filename = buildExportFilename(transaction);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`,
    );
    return buildTransactionExport(transaction);
  }
}
