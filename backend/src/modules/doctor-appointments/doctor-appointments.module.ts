import { Module } from '@nestjs/common';

import { DoctorAppointmentsService } from './doctor-appointments.service.js';
import { DoctorAppointmentsController } from './doctor-appointments.controller.js';

@Module({
  controllers: [DoctorAppointmentsController],
  providers: [DoctorAppointmentsService],
})
export class DoctorAppointmentsModule {}
