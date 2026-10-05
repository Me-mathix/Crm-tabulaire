import { Module } from '@nestjs/common';
import { ContactsModule } from './contacts/contacts.module';
import { DatabaseModule } from './database/database.module';
import { FieldsModule } from './fields/fields.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [DatabaseModule, FieldsModule, ContactsModule],
  controllers: [HealthController],
})
export class AppModule {}
