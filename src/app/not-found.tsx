import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg rounded-xl border border-line bg-white p-6">
      <h1 className="text-lg font-semibold text-navy">Page not found</h1>
      <Link href="/" className="btn-primary mt-4">Go to start</Link>
    </div>
  );
}
