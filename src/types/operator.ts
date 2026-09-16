export type OperatorOption = {
  id: string;
  name: string;
  phone: string | null;
  /** Null means the operator works at any site. */
  siteId: string | null;
  siteName: string | null;
};

/** One row of the Operators page, including deactivated people. */
export type OperatorRow = {
  id: string;
  name: string;
  phone: string | null;
  siteId: string | null;
  siteName: string | null;
  /** The portal account this person signs in with, when they have one. */
  userId: string | null;
  userName: string | null;
  isActive: boolean;
};

export type CreateOperatorInput = { name: string; phone?: string; siteId?: string; userId?: string };

export type UpdateOperatorInput = Partial<{ name: string; phone: string | null; siteId: string | null }>;
