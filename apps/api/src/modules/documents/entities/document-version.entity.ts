import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum DocumentVersionStatus {
  QUEUED = 'queued',
  PROCESSING = 'processing',
  READY = 'ready',
  FAILED = 'failed',
}

@Entity({ name: 'document_versions' })
export class DocumentVersion {
  @PrimaryColumn({ type: 'uuid', default: () => 'gen_random_uuid()' })
  id!: string;
  @Column({ name: 'document_id', type: 'uuid' }) documentId!: string;
  @Column({ name: 'version_number', type: 'integer' }) versionNumber!: number;
  @Column({ name: 'object_key', type: 'varchar', length: 500 })
  objectKey!: string;
  @Column({ name: 'media_type', type: 'varchar', length: 100 })
  mediaType!: string;
  @Column({ name: 'size_bytes', type: 'bigint' }) sizeBytes!: string;
  @Column({
    type: 'enum',
    enum: DocumentVersionStatus,
    enumName: 'document_version_status',
  })
  status!: DocumentVersionStatus;
  @Column({
    name: 'extracted_text',
    type: 'text',
    nullable: true,
    select: false,
  })
  extractedText!: string | null;
  @Column({ name: 'error_code', type: 'varchar', length: 100, nullable: true })
  errorCode!: string | null;
  @Column({
    name: 'error_message',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  errorMessage!: string | null;
  @Column({ name: 'attempt_count', type: 'integer', default: 0 })
  attemptCount!: number;
  @Column({ name: 'created_by', type: 'uuid' }) createdBy!: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
