import { Module, forwardRef } from '@nestjs/common';

import { AiModule } from '../ai/ai.module.js';
import { MemoriesController } from './memories.controller.js';
import { MemoryEmbeddingService } from './memory-embedding.service.js';
import { MemoryExtractorService } from './memory-extractor.service.js';
import { MemoryImportanceService } from './memory-importance.service.js';
import { MemoriesService } from './memories.service.js';
import { MemorySearchService } from './memory-search.service.js';
import { MemoryContextService } from './memory-context.service.js';
@Module({
  imports: [
    forwardRef(() => AiModule),
  ],
  controllers: [
    MemoriesController,
  ],
  providers: [
    MemoriesService,
    MemoryExtractorService,
    MemoryImportanceService,
    MemoryEmbeddingService,
    MemorySearchService,
    MemoryContextService
  ],
  exports: [
    MemoriesService,
    MemoryExtractorService,
    MemoryImportanceService,
    MemoryEmbeddingService,
    MemorySearchService,
    MemoryContextService
  ],
})
export class MemoriesModule { }