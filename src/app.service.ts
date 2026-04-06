import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class AppService {
  constructor(private dataSource: DataSource) {}

  async testQuery() {
    const result = await this.dataSource.query('SELECT SYSDATE AS fecha FROM DUAL');
    return { oracle: 'conectado', resultado: result };
  }
}
