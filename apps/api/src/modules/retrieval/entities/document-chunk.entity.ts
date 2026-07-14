import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'document_chunks' })
export class DocumentChunk {
  @PrimaryColumn({ type: 'uuid', default: () => 'gen_random_uuid()' })
  id!: string;

  @Column({ name: 'document_version_id', type: 'uuid' })
  documentVersionId!: string;

  @Column({ name: 'chunk_index', type: 'integer' })
  chunkIndex!: number;

  @Column({ type: 'text' })
  content!: string;

  @Column({ name: 'start_offset', type: 'integer' })
  startOffset!: number;

  @Column({ name: 'end_offset', type: 'integer' })
  endOffset!: number;

  @Column({ type: 'vector', nullable: true, select: false })
  embedding!: number[] | null;

  @Column({
    name: 'embedding_model',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  embeddingModel!: string | null;

  @Column({ name: 'embedding_dimensions', type: 'integer', nullable: true })
  embeddingDimensions!: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
