import { IsString, MaxLength, MinLength } from 'class-validator';

export class ConfirmDeleteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  confirmName!: string;
}
