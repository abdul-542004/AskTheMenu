import { redirect } from "next/navigation";

// Auth is not used in AskTheMenu MVP — redirect to the main chat.
export default function LoginPage() {
  redirect("/chat/table-1");
}
