import { Module } from '@nestjs/common';

import { FirebaseAuthDeletion } from '../auth/firebase-auth-deletion.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

@Module({
  controllers: [UsersController],
  providers: [UsersService, FirebaseAuthDeletion],
  exports: [UsersService],
})
export class UsersModule { }
