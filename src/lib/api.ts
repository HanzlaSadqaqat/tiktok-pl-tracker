import "server-only";
import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { formatZodError } from "./validation";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new HttpError(400, "Request body must be JSON");
  }
  return schema.parse(body);
}

/** Wraps a route handler with consistent JSON error responses. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
      if (err instanceof ZodError) return NextResponse.json({ error: formatZodError(err) }, { status: 400 });
      if (typeof err === "object" && err && "code" in err && (err as { code: unknown }).code === 11000) {
        const isEmail = "keyPattern" in err && typeof err.keyPattern === "object" && err.keyPattern !== null && "email" in err.keyPattern;
        const message = isEmail ? "A user with this email already exists" : "An order with this Order ID already exists";
        return NextResponse.json({ error: message }, { status: 409 });
      }
      console.error(err);
      const message = err instanceof Error && err.message.startsWith("MONGODB_URI") ? err.message : "Something went wrong";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  };
}

export const isObjectId = (id: string) => /^[a-f0-9]{24}$/i.test(id);
