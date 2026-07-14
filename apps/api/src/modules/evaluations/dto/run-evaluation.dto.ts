import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

class EvaluationCaseDto {
  @IsString() @MinLength(2) @MaxLength(4000) question!: string;
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  expectedKeywords!: string[];
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  expectedFiles!: string[];
}

export class RunEvaluationDto {
  @IsString() @MinLength(1) @MaxLength(120) name!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => EvaluationCaseDto)
  cases!: EvaluationCaseDto[];
}
