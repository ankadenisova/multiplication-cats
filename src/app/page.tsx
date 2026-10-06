import { currentUser } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import Study from "./components/Study";
import { parentEmails } from "@/lib/parent-auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await currentUser();
  if (!user) redirect("/auth/sign-in");
  return <Study name={user.name || "Привет"} userId={user.id} isParent={parentEmails().includes(user.email.toLowerCase())} />;
}
