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
  Query,
} from '@nestjs/common';
import {
  createContactSchema,
  listContactsQuerySchema,
  updateContactSchema,
  type Contact,
  type ContactPage,
  type CreateContactInput,
  type ListContactsQuery,
  type UpdateContactInput,
} from '@crm/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ContactsService } from './contacts.service';

@Controller('contacts')
export class ContactsController {
  constructor(private readonly contacts: ContactsService) {}

  @Get()
  list(@Query(new ZodValidationPipe(listContactsQuerySchema)) query: ListContactsQuery): Promise<ContactPage> {
    return this.contacts.list(query);
  }

  @Post()
  create(@Body(new ZodValidationPipe(createContactSchema)) body: CreateContactInput): Promise<Contact> {
    return this.contacts.create(body.values);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateContactSchema)) body: UpdateContactInput,
  ): Promise<Contact> {
    return this.contacts.update(id, body.values);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.contacts.remove(id);
  }
}
