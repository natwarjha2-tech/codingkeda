import { redirect } from "next/navigation";

/** /account/profile → the existing profile editor. */
export default function AccountProfilePage() {
  redirect("/profile");
}
