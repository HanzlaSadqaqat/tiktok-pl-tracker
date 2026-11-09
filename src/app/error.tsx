"use client";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const dbMissing = error.message?.includes("MONGODB_URI");
  return (
    <div className="mx-auto max-w-lg rounded-xl border border-line bg-white p-6">
      <h1 className="text-lg font-semibold text-navy">{dbMissing ? "Database not configured" : "Something went wrong"}</h1>
      <p className="mt-2 text-sm text-muted">
        {dbMissing
          ? "Add MONGODB_URI to your environment (.env.local for local use, or your hosting provider's settings), then reload."
          : "The page could not load. Check that MongoDB is reachable, then try again."}
      </p>
      <button className="btn-primary mt-4" onClick={reset}>Try again</button>
    </div>
  );
}
