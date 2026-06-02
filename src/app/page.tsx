import { SignedIn, SignedOut } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import Link from "next/link";

export default function Home() {
  return (
    <>
      <SignedIn>
        {/* Redirect logged-in users to dashboard */}
        <RedirectToDashboard />
      </SignedIn>
      <SignedOut>
        <div className="flex min-h-screen flex-col items-center justify-center gap-4">
          <h1 className="text-3xl font-bold">Preacher&#39;s Lens</h1>
          <p className="text-muted-foreground">Sermon transcription and coaching analysis</p>
          <Link
            href="/sign-in"
            className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
          >
            Sign In
          </Link>
        </div>
      </SignedOut>
    </>
  );
}

function RedirectToDashboard() {
  redirect("/dashboard");
}
