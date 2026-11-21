import { redirect } from "next/navigation";

/** /support → the contact page (in-app Help & Support, email, social). */
export default function SupportPage() {
  redirect("/contact");
}
