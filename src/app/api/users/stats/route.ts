import { withActor } from "@/app/api/_lib/routeHandler";
import { UserService } from "@/services/userService";

/** `AccountStats`: counts by role and active accounts. */
export const GET = withActor(() => UserService.getStats(), { admin: true });
