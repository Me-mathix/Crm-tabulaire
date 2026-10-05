import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import {
  createFieldSchema,
  reorderFieldsSchema,
  updateFieldSchema,
  type CreateFieldInput,
  type Field,
  type ReorderFieldsInput,
  type UpdateFieldInput,
} from '@crm/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { FieldsService } from './fields.service';

@Controller('fields')
export class FieldsController {
  constructor(private readonly fields: FieldsService) {}

  @Get()
  list(): Promise<Field[]> {
    return this.fields.list();
  }

  @Post()
  create(@Body(new ZodValidationPipe(createFieldSchema)) body: CreateFieldInput): Promise<Field> {
    return this.fields.create(body);
  }

  @Put('order')
  reorder(@Body(new ZodValidationPipe(reorderFieldsSchema)) body: ReorderFieldsInput): Promise<Field[]> {
    return this.fields.reorder(body.ids);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateFieldSchema)) body: UpdateFieldInput,
  ): Promise<Field> {
    return this.fields.update(id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.fields.remove(id);
  }
}
