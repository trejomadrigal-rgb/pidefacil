import { IsDateString, IsNotEmpty } from 'class-validator';

export class GetDashboardDto {
  @IsNotEmpty()
  @IsDateString()
  startDate!: string;

  @IsNotEmpty()
  @IsDateString()
  endDate!: string;
}
