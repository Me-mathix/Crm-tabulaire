import { Module } from '@nestjs/common';
import { FieldsModule } from '../fields/fields.module';
import { ContactsController } from './contacts.controller';
import { ContactsService } from './contacts.service';

@Module({
  imports: [FieldsModule],
  controllers: [ContactsController],
  providers: [ContactsService],
})
export class ContactsModule {}
