import { withActor } from "@/app/api/_lib/routeHandler";
import { TheftAlertService } from "@/services/theftAlertService";
import type { AlertState } from "@/types/alerts";
import { oneOf } from "@/utils/actionUtils";

const STATES: AlertState[] = ["open", "reviewing", "resolved"];

/** `AlertRow[]`: the alert queue, newest first, with this user's read state. `?state=` filters by the page's tabs. */
export const GET = withActor(
  ({ actor, request }) => {
    const state = oneOf(new URL(request.url).searchParams.get("state"), STATES);
    return TheftAlertService.list({ userId: actor.id, state });
  },
  { admin: true }
);
