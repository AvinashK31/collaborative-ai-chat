import { Module } from '@nestjs/common';
import { LangchainService } from './langchain.service';
import { LangchainController } from './langchain.controller';
import { VectorService } from './vector.service';

@Module({
  controllers: [LangchainController],
  providers: [LangchainService, VectorService],
  exports: [LangchainService, VectorService],
})
export class LangchainModule {}