import { Injectable } from '@nestjs/common';
import { DatabaseService } from './database/database.service';

@Injectable()
export class AppService {
  constructor(private db: DatabaseService) {}

  async testQuery() {
    // Ejemplo: consulta simple a Oracle
    const result = await this.db.query('SELECT SYSDATE AS fecha FROM DUAL');
    return { oracle: 'conectado', resultado: result };
  }
}
