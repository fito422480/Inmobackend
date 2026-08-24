export class MetasQueryDto {
  mes?: string;
}

export type MetaCobradorCodigo =
  | 'MATI'
  | 'JESUS'
  | 'FERNANDO'
  | 'JUDICIALES';

export class MetasPeriodoDto {
  mes: string;
  fechaInicio: string;
  fechaFin: string;
  fechaFinMesAnterior: string;
}

export class MetaCobradorDto {
  codigo: MetaCobradorCodigo;
  cobrador: string;
  tramoMora: string;
  importeCuotas: number;
  saldoVencido: number;
  valorCartera: number;
}

export class MetasResponseDto {
  periodo: MetasPeriodoDto;
  data: MetaCobradorDto[];
  totalCartera: number;
}
