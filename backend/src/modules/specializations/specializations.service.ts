 
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Specialization } from './entities/specialization.entity.js';
import { CreateSpecializationDto } from './dto/create-specialization.dto.js';
import { UpdateSpecializationDto } from './dto/update-specialization.dto.js';

@Injectable()
export class SpecializationsService {
  constructor(
    @InjectRepository(Specialization)
    private readonly specializationRepository: Repository<Specialization>,
  ) {}

  async create(createDto: CreateSpecializationDto) {
    const existing = await this.specializationRepository.findOne({
      where: { name: createDto.name },
    });

    if (existing) {
      throw new ConflictException('Specialization already exists');
    }

    const specialization = this.specializationRepository.create(createDto);

    return this.specializationRepository.save(specialization);
  }

  async findAll() {
    return this.specializationRepository.find({
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string) {
    const specialization = await this.specializationRepository.findOne({
      where: { id },
    });

    if (!specialization) {
      throw new NotFoundException(
        `Specialization with ID ${id} not found`,
      );
    }

    return specialization;
  }

  async update(id: string, updateDto: UpdateSpecializationDto) {
    const specialization = await this.findOne(id);

    if (updateDto.name && updateDto.name !== specialization.name) {
      const existing = await this.specializationRepository.findOne({
        where: { name: updateDto.name },
      });

      if (existing) {
        throw new ConflictException('Specialization already exists');
      }
    }

    Object.assign(specialization, updateDto);

    return this.specializationRepository.save(specialization);
  }

  async remove(id: string) {
    const specialization = await this.findOne(id);

    await this.specializationRepository.remove(specialization);

    return {
      message: 'Specialization deleted successfully',
    };
  }
}
