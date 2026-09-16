"use client";

import { type QueryKey, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { ActionState } from "@/types/actions";

/** A server action that returned `{ ok: false }`. `fields` maps form field names to messages. */
export class ActionError extends Error {
  constructor(message: string, public readonly fields?: Record<string, string>) {
    super(message);
    this.name = "ActionError";
  }
}

type SuccessState = Extract<ActionState, { ok: true }>;

const GENERIC = "Something went wrong. Please try again.";

/**
 * Runs a server action as a TanStack mutation.
 *
 * A `{ ok: false }` result becomes an `ActionError` and is reported as a toast titled `errorTitle`, so no form
 * has to render an error banner. Forms still read `fieldErrors(mutation.error)` to mark the fields at fault.
 * The `invalidates` keys are refreshed after every attempt, since a partly failed action may still have changed data.
 */
export function useActionMutation<TInput>({
  action,
  invalidates,
  errorTitle = "Couldn't save",
}: {
  action: (input: TInput) => Promise<ActionState>;
  invalidates: QueryKey[];
  /** Toast title when the action fails, e.g. "Couldn't add equipment". */
  errorTitle?: string;
}) {
  const queryClient = useQueryClient();

  return useMutation<SuccessState, Error, TInput>({
    mutationFn: async (input) => {
      const result = await action(input);
      if (!result?.ok) throw new ActionError(result?.error ?? GENERIC, result?.fields);
      return result;
    },
    onError: (error) => {
      if (error instanceof ActionError) {
        toast.error(errorTitle, { description: error.message });
        return;
      }
      // The action itself threw (a bug, a dropped connection, or a stale action id after a hot reload).
      // Production sees the generic line; development gets the real message, and the console gets the stack.
      console.error(`${errorTitle}:`, error);
      const detail = process.env.NODE_ENV === "production" ? GENERIC : `${GENERIC} (${error.message})`;
      toast.error(errorTitle, { description: detail });
    },
    onSettled: () => Promise.all(invalidates.map((queryKey) => queryClient.invalidateQueries({ queryKey }))),
  });
}

/** Field messages from a failed mutation, if the server sent any. Shown under the inputs they belong to. */
export const fieldErrors = (error: Error | null) => (error instanceof ActionError ? error.fields : undefined);
