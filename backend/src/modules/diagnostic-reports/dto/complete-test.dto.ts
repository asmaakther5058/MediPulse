import { IsOptional, IsString, MaxLength } from 'class-validator';

// Sent as multipart/form-data together with an optional "file"
// (PDF, PNG or JPEG, max 5 MB). Findings, a file, or both.
export class CompleteTestDto {
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  findings?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  centerNote?: string;
}
