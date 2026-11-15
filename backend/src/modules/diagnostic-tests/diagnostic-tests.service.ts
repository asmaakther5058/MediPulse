import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';

import { DiagnosticTest } from './entities/diagnostic-test.entity.js';
import { CreateDiagnosticTestDto } from './dto/create-diagnostic-test.dto.js';
import { UpdateDiagnosticTestDto } from './dto/update-diagnostic-test.dto.js';
import { DiagnosticTestQueryDto } from './dto/diagnostic-test-query.dto.js';
import { paginate } from '../../common/dto/pagination-query.dto.js';
import { isUniqueViolation } from '../../common/utils/safe-user.util.js';

// The single diagnostic center's test catalog (spec 5B)
@Injectable()
export class DiagnosticTestsService {
  constructor(
    @InjectRepository(DiagnosticTest)
    private readonly repo: Repository<DiagnosticTest>,
  ) {}

  // Returns the row as stored, so prices come back as e.g. "2200.00"
  private async save(test: DiagnosticTest) {
    try {
      const saved = await this.repo.save(test);
      return await this.findOne(saved.id);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('A diagnostic test with this name already exists');
      }
      throw error;
    }
  }

  create(dto: CreateDiagnosticTestDto) {
    return this.save(this.repo.create({ ...dto, price: String(dto.price) }));
  }

  private async list(query: DiagnosticTestQueryDto, activeOnly: boolean) {
    const { page, limit } = query;
    const [items, total] = await this.repo.findAndCount({
      where: {
        ...(activeOnly ? { isActive: true } : {}),
        ...(query.search?.trim() ? { testName: ILike(`%${query.search.trim()}%`) } : {}),
        ...(query.category ? { category: query.category } : {}),
      },
      order: { testName: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return paginate(items, total, page, limit);
  }

  findAll(query: DiagnosticTestQueryDto) {
    return this.list(query, false);
  }

  findActive(query: DiagnosticTestQueryDto) {
    return this.list(query, true);
  }

  async findOne(id: string) {
    const test = await this.repo.findOne({ where: { id } });

    if (!test) {
      throw new NotFoundException('Diagnostic test not found');
    }

    return test;
  }

  async update(id: string, dto: UpdateDiagnosticTestDto) {
    const test = await this.findOne(id);
    const { price, ...rest } = dto;
    Object.assign(test, rest);
    if (price !== undefined) test.price = String(price);
    return this.save(test);
  }

  async remove(id: string) {
    const test = await this.findOne(id);

    try {
      await this.repo.remove(test);
    } catch (error) {
      if ((error as { code?: string }).code === '23503' ||
          (error as { driverError?: { code?: string } }).driverError?.code === '23503') {
        throw new ConflictException(
          'This test has recommendations or bookings; set isActive to false instead of deleting it',
        );
      }
      throw error;
    }

    return { message: 'Diagnostic test deleted successfully' };
  }
}
