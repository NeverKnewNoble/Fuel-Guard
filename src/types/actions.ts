/** What a form's server action returns to `useActionState`. `fields` maps form field names to messages. */
export type ActionState =
  | { ok: true; message: string }
  | { ok: false; error: string; fields?: Record<string, string> }
  | undefined;
