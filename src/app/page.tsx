import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function Home() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-3xl font-bold">Preacher&apos;s Lens</h1>
      <p className="text-muted-foreground">Sermon transcription and coaching analysis</p>
      <Link
        href="/sign-in"
        className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
      >
        Sign In
      </Link>
    </div>
  );
}
