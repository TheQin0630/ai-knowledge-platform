import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class AskKnowledgeBaseDto {
  @IsString()
  @MinLength(2)
  @MaxLength(4000)
  question!: string;

  @IsOptional()
  @IsIn(['openai', 'glm', 'deepseek', 'qwen', 'ollama', 'custom'])
  provider?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  model?: string;
}
