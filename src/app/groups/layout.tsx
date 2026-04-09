import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

/**
 * All /groups/* routes require an authenticated session.
 */
export default async function GroupsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
  return <>{children}</>;
}
