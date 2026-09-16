import { withActor } from "@/app/api/_lib/routeHandler";
import { SupplierService } from "@/services/supplierService";

/** `SupplierOption[]`: known suppliers, so the Supplier field can suggest them. */
export const GET = withActor(() => SupplierService.list(), { admin: true });
