import { Matches } from 'class-validator';

/** Customer mengganti waktu pengambilan kuenya. */
export class UpdatePickupDateDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'pickupDate harus berformat YYYY-MM-DD',
  })
  pickupDate: string;
}
