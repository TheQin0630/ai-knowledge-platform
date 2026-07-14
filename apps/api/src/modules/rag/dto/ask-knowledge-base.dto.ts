import { IsString, MaxLength, MinLength } from 'class-validator';

export class AskKnowledgeBaseDto {
  @IsString()
  @MinLength(2)
  @MaxLength(4000)
  question!: string;
}
