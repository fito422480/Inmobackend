import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

// ⚠️ Reemplazá EJEMPLO por el nombre real de tu tabla en Oracle
@Entity({ name: 'EJEMPLO' })
export class EjemploEntity {

  @PrimaryGeneratedColumn({ name: 'ID' })
  id: number;

  @Column({ name: 'NOMBRE', length: 100 })
  nombre: string;

  @Column({ name: 'DESCRIPCION', length: 255, nullable: true })
  descripcion: string;

  @Column({ name: 'ACTIVO', type: 'char', default: 'S' })
  activo: string;

  @CreateDateColumn({ name: 'FECHA_CREACION' })
  fechaCreacion: Date;
}
