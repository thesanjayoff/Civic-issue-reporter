import { setRequestLocale } from "next-intl/server";
import { AppHeader } from "@/components/AppHeader";
import { ModerationQueue } from "@/components/admin/ModerationQueue";

/**
 * No auth/role gate yet — anyone with the URL can reach this. Fine for a
 * local demo, not for a real deployment; see README "Known limitations".
 */
export default async function ModerationPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="flex-1 px-4 py-6">
        <div className="mx-auto max-w-xl">
          <h1 className="text-xl font-bold">Moderation queue</h1>
          <p className="mt-1 text-sm text-amber-700">
            This page has no access control in this build — do not deploy it publicly without adding one.
          </p>
          <div className="mt-4">
            <ModerationQueue />
          </div>
        </div>
      </main>
    </div>
  );
}
