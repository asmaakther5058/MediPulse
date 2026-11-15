
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { DiagnosticTest } from './entities/diagnostic-test.entity.js';
import { CreateDiagnosticTestDto } from './dto/create-diagnostic-test.dto.js';
import { UpdateDiagnosticTestDto } from './dto/update-diagnostic-test.dto.js';

@Injectable()
export class DiagnosticTestsService {
  constructor(
    @InjectRepository(DiagnosticTest)
    private readonly diagnosticTestRepository: Repository<DiagnosticTest>,
  ) {}

  async create(createDto: CreateDiagnosticTestDto) {
    const existingTest = await this.diagnosticTestRepository.findOne({
      where: { testName: createDto.testName },
    });

    if (existingTest) {
      throw new ConflictException('Diagnostic test already exists');
    }

    const test = this.diagnosticTestRepository.create(createDto);

    return this.diagnosticTestRepository.save(test);
  }

  async findAll() {
    return this.diagnosticTestRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findActive() {
    return this.diagnosticTestRepository.find({
      where: { isActive: true },
      order: { testName: 'ASC' },
    });
  }

  async findOne(id: string) {
    const test = await this.diagnosticTestRepository.findOne({
      where: { id },
    });

    if (!test) {
      throw new NotFoundException('Diagnostic test not found');
    }

    return test;
  }

  async update(id: string, updateDto: UpdateDiagnosticTestDto) {
    const test = await this.findOne(id);

    if (updateDto.testName && updateDto.testName !== test.testName) {
      const existingTest = await this.diagnosticTestRepository.findOne({
        where: { testName: updateDto.testName },
      });

      if (existingTest) {
        throw new ConflictException('Diagnostic test name already exists');
      }
    }

    Object.assign(test, updateDto);

    return this.diagnosticTestRepository.save(test);
  }

  async remove(id: string) {
    const test = await this.findOne(id);

    await this.diagnosticTestRepository.remove(test);

    return {
      message: 'Diagnostic test deleted successfully',
    };
  }
}
