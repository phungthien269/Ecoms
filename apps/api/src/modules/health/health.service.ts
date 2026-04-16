import { Injectable } from "@nestjs/common";
import type { HealthStatus } from "@ecoms/contracts";

@Injectable()
export class HealthService {
  getHealth(): HealthStatus {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      service: "ecoms-api"
    };
  }
}
