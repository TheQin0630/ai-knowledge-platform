import {
  Inject,
  Injectable,
  Logger,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Queue, Worker } from 'bullmq';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { EnvironmentVariables } from '../../config/environment.schema';
import { DocumentIndexService } from '../retrieval/document-index.service';
import {
  DOCUMENT_QUEUE_NAME,
  DOCUMENT_STORAGE,
} from './document-ingestion.constants';
import type { DocumentStorage } from './document-storage.service';
import { DocumentParserService } from './document-parser.service';
import {
  DocumentVersion,
  DocumentVersionStatus,
} from './entities/document-version.entity';

interface IngestionJob {
  versionId: string;
}

@Injectable()
export class DocumentQueueService implements OnApplicationShutdown {
  private readonly logger = new Logger(DocumentQueueService.name);
  private readonly queue: Queue<IngestionJob>;
  private readonly worker: Worker<IngestionJob>;

  constructor(
    config: ConfigService<EnvironmentVariables, true>,
    @InjectRepository(DocumentVersion)
    private readonly versions: Repository<DocumentVersion>,
    @Inject(DOCUMENT_STORAGE) private readonly storage: DocumentStorage,
    private readonly parser: DocumentParserService,
    private readonly indexer: DocumentIndexService,
  ) {
    const redisUrl = config.get('REDIS_URL', { infer: true });
    const connection = redisConnection(redisUrl);
    this.queue = new Queue(DOCUMENT_QUEUE_NAME, {
      connection,
    });
    this.worker = new Worker(DOCUMENT_QUEUE_NAME, (job) => this.process(job), {
      connection,
      concurrency: 2,
    });
  }

  async enqueue(versionId: string): Promise<void> {
    const existing = await this.queue.getJob(versionId);
    if (existing) {
      const state = await existing.getState();
      if (state === 'failed' || state === 'completed') {
        await existing.remove();
      } else {
        throw new Error(`Document version job is already ${state}`);
      }
    }
    await this.queue.add(
      'extract',
      { versionId },
      {
        jobId: versionId,
        attempts: 3,
        backoff: { type: 'exponential', delay: 1_000 },
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    );
  }

  private async process(job: Job<IngestionJob>): Promise<void> {
    const version = await this.versions.findOneByOrFail({
      id: job.data.versionId,
    });
    await this.versions.update(version.id, {
      status: DocumentVersionStatus.PROCESSING,
      attemptCount: job.attemptsMade + 1,
      errorCode: null,
      errorMessage: null,
    });
    try {
      const body = await this.storage.get(version.objectKey);
      const extractedText = await this.parser.extract(body, version.mediaType);
      const indexResult = await this.indexer.index(version.id, extractedText);
      await this.versions.update(version.id, {
        status: DocumentVersionStatus.READY,
        extractedText,
      });
      this.logger.log({
        event: 'document_parse_succeeded',
        versionId: version.id,
        ...indexResult,
      });
    } catch (error) {
      const finalAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
      await this.versions.update(version.id, {
        status: finalAttempt
          ? DocumentVersionStatus.FAILED
          : DocumentVersionStatus.QUEUED,
        errorCode: 'DOCUMENT_PARSE_FAILED',
        errorMessage: safeErrorMessage(error),
      });
      this.logger.warn({
        event: 'document_parse_failed',
        versionId: version.id,
        finalAttempt,
        attempt: job.attemptsMade + 1,
      });
      throw error;
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.worker.close();
    await this.queue.close();
  }
}

function redisConnection(redisUrl: string) {
  const url = new URL(redisUrl);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    db: url.pathname.length > 1 ? Number(url.pathname.slice(1)) : 0,
    ...(url.protocol === 'rediss:' ? { tls: {} } : {}),
    maxRetriesPerRequest: null,
  };
}

function safeErrorMessage(error: unknown): string {
  return (
    error instanceof Error ? error.message : 'Document parsing failed'
  ).slice(0, 500);
}
