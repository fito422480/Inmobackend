import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EjemploEntity } from './ejemplo.entity';

@Injectable()
export class EjemploService {
  constructor(
    @InjectRepository(EjemploEntity)
    private repo: Repository<EjemploEntity>,
  ) {}

  // GET todos
  findAll(): Promise<EjemploEntity[]> {
    return this.repo.find({ where: { activo: 'S' } });
  }

  // GET por ID
  async findOne(id: number): Promise<EjemploEntity> {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) throw new NotFoundException(`Registro ${id} no encontrado`);
    return item;
  }

  // POST
  create(data: Partial<EjemploEntity>): Promise<EjemploEntity> {
    const nuevo = this.repo.create(data);
    return this.repo.save(nuevo);
  }

  // PUT
  async update(id: number, data: Partial<EjemploEntity>): Promise<EjemploEntity> {
    await this.repo.update(id, data);
    return this.findOne(id);
  }

  // DELETE (soft delete cambiando ACTIVO)
  async remove(id: number): Promise<void> {
    await this.repo.update(id, { activo: 'N' });
  }

  // Query personalizada con QueryBuilder
  buscarPorNombre(nombre: string): Promise<EjemploEntity[]> {
    return this.repo
      .createQueryBuilder('e')
      .where('UPPER(e.nombre) LIKE UPPER(:nombre)', { nombre: `%${nombre}%` })
      .andWhere('e.activo = :activo', { activo: 'S' })
      .orderBy('e.id', 'DESC')
      .getMany();
  }
}
