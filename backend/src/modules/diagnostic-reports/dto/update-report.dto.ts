import { IsOptional, IsString, MaxLength } from 'class-validator';

// multipart/form-data: new findings and/or a replacement "file"
export class UpdateReportDto {
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  findings?: string;
}
