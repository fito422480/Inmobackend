import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { TunnelService } from '../tunnel/tunnel.service';
import { TunnelModule } from '../tunnel/tunnel.module';

@Module({
  imports: [
    TunnelModule,
    TypeOrmModule.forRootAsync({
      inject: [ConfigService, TunnelService],
      useFactory: async (config: ConfigService, tunnel: TunnelService) => {
        // Esperar que la ruta de conexion quede lista antes de conectar
        await tunnel.waitUntilReady();

        const databaseHost = tunnel.getDatabaseHost();
        const databasePort = tunnel.getDatabasePort();
        const oracleClientLibDir = config.get<string>('ORA_CLIENT_LIB_DIR');
        const poolMin = parsePositiveNumber(config.get('ORA_POOL_MIN'), 2);
        const poolMax = parsePositiveNumber(config.get('ORA_POOL_MAX'), 10);
        const poolIncrement = parsePositiveNumber(
          config.get('ORA_POOL_INCREMENT'),
          1,
        );

        return {
          type: 'oracle',
          host: databaseHost,
          port: databasePort,
          serviceName: config.get('ORA_SERVICE'),
          username: config.get('ORA_USER'),
          password: config.get('ORA_PASSWORD'),
          thickMode: oracleClientLibDir
            ? { libDir: oracleClientLibDir }
            : true,
          // Entidades: agregá las tuyas acá
          entities: [__dirname + '/../**/*.entity{.ts,.js}'],
          synchronize: false,   //NUNCA en true con Oracle en producción
          logging: config.get('NODE_ENV') !== 'production',
          extra: {
            poolMin,
            poolMax,
            poolIncrement,
          },
        };
      },
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}

function parsePositiveNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
