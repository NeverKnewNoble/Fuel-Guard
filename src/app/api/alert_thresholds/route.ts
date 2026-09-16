import { withActor } from "@/app/api/_lib/routeHandler";
import { AlertThresholdService } from "@/services/alertThresholdService";

/** `AlertThreshold[]`, or `null` when the thresholds haven't been set up. */
export const GET = withActor(() => AlertThresholdService.listIfConfigured(), { admin: true });
