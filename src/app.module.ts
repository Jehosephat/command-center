import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';
import { HealthModule } from './modules/health/health.module';
import { GalaChainModule } from './modules/galachain/galachain.module';
import { MarketplaceModule } from './modules/marketplace/marketplace.module';
import { RequestLoggerMiddleware } from './middleware/request-logger.middleware';
import { SpaFallbackMiddleware } from './middleware/spa-fallback.middleware';
import configuration from './config/configuration';
import { Listing } from './modules/marketplace/entities/listing.entity';
import { Purchase } from './modules/marketplace/entities/purchase.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'client'),
      exclude: ['/api{/*path}'],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'better-sqlite3' as const,
        database: config.get<string>('database.path', './data/marketplace.sqlite'),
        entities: [Listing, Purchase],
        synchronize: true, // Auto-create tables (fine for SQLite dev/prod)
      }),
    }),
    HealthModule,
    GalaChainModule,
    MarketplaceModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply request logging middleware to all API routes in development
    if (process.env.NODE_ENV !== 'production') {
      consumer.apply(RequestLoggerMiddleware).forRoutes('*');
    }

    // SPA fallback middleware - serves index.html for non-API, non-file routes
    // Must be applied AFTER static file serving
    consumer.apply(SpaFallbackMiddleware).forRoutes('*');
  }
}
