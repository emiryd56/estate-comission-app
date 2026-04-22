import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  MongooseHealthIndicator,
} from '@nestjs/terminus';

@ApiTags('Health')
@Controller()
export class AppController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: MongooseHealthIndicator,
  ) {}

  @Get('health')
  @HealthCheck()
  @ApiOperation({ summary: 'Liveness/readiness probe (includes MongoDB ping)' })
  @ApiResponse({ status: 200, description: 'Service and database are reachable.' })
  @ApiResponse({ status: 503, description: 'A dependency is unhealthy.' })
  check() {
    return this.health.check([() => this.db.pingCheck('mongodb')]);
  }
}
