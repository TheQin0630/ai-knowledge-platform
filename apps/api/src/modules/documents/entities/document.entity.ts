import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'documents' })
export class Document {
  @PrimaryColumn({ type: 'uuid', default: () => 'gen_random_uuid()' })
  id!: string;
  @Column({ name: 'knowledge_base_id', type: 'uuid' }) knowledgeBaseId!: string;
  @Column({ name: 'file_name', type: 'varchar', length: 255 })
  fileName!: string;
  @Column({ name: 'created_by', type: 'uuid' }) createdBy!: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
