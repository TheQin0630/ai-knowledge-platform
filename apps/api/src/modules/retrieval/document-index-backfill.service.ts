import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DocumentIndexService } from './document-index.service';

interface HistoricalVersion {
  id: string;
  extracted_text: string;
}

@Injectable()
export class DocumentIndexBackfillService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DocumentIndexBackfillService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly indexer: DocumentIndexService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      const indexedVersions = await this.backfill();
      if (indexedVersions > 0) {
        this.logger.log({
          event: 'document_index_backfill_completed',
          indexedVersions,
        });
      }
    } catch (error) {
      this.logger.warn({
        event: 'document_index_backfill_failed',
        reason:
          error instanceof Error
            ? error.message.slice(0, 200)
            : 'Unknown error',
      });
    }
  }

  async backfill(): Promise<number> {
    const versions = await this.dataSource.query<HistoricalVersion[]>(
      `SELECT dv.id, dv.extracted_text
       FROM document_versions dv
       WHERE dv.status = 'ready'
         AND dv.extracted_text IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM document_chunks chunk WHERE chunk.document_version_id = dv.id
         )
       ORDER BY dv.created_at
       LIMIT 100`,
    );
    for (const version of versions) {
      await this.indexer.index(version.id, version.extracted_text);
    }
    return versions.length;
  }
}
