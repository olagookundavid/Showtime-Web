import { isAxiosError } from "axios";

/** Header the server reads to make a money-moving request happen once. */
export const IDEMPOTENCY_HEADER = "Idempotency-Key";

/** A fresh key for one attempt at a checkout, top-up or transfer. */
export const newIdempotencyKey = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
};

/** Request options that carry the key, or nothing when there isn't one. */
export const withIdempotencyKey = (key?: string) =>
  key ? { headers: { [IDEMPOTENCY_HEADER]: key } } : {};

/**
 * Whether to keep the key after a request ended in err. Keep it when the outcome
 * is unknown (no answer from the server) or the first try is still running, so a
 * retry replays that attempt instead of paying again. After any real answer the
 * attempt is over, and the next one gets a new key.
 */
export const shouldKeepIdempotencyKey = (err: unknown): boolean => {
  if (!isAxiosError(err)) return false;
  if (!err.response) return true;
  return err.response.status === 409 && err.response.data?.code === "REQUEST_IN_PROGRESS";
};
