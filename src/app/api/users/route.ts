import { withActor } from "@/app/api/_lib/routeHandler";
import { UserService } from "@/services/userService";

/** `AccountRow[]`: every account, ordered by name. Never includes password hashes. */
export const GET = withActor(() => UserService.listAccounts(), { admin: true });
