import { withActor } from "@/app/api/_lib/routeHandler";
import { TheftAlertService } from "@/services/theftAlertService";

/** `number`: unresolved alerts this user hasn't read — the sidebar badge. */
export const GET = withActor(({ actor }) => TheftAlertService.getUnreadCount(actor.id), { admin: true });
