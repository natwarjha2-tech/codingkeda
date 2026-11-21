import { redirect } from "next/navigation";

/** /account → subscription overview. */
export default function AccountPage() {
  redirect("/account/subscription");
}
