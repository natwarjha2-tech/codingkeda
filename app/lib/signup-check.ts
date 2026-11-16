/**
 * The checks every website sign-up form runs before calling /api/auth/signup
 * (the server repeats them). Browser-safe: no server imports.
 * Returns an error message, or the extra fields to send with the sign-up.
 */
import { validateName, cleanName } from "@/app/lib/name";
import { dobError, isMinorDob } from "@/app/lib/age";
import { validatePassword, PASSWORD_HINT } from "@/app/lib/password-rules";

export interface SignupInput {
  name: string;
  email: string;
  mobile?: string; // only some forms ask for it
  password: string;
  dob: string;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function checkSignup(f: SignupInput):
  | { error: string }
  | { body: { name: string; email: string; password: string; dob: string; parentName?: string; parentEmail?: string; parentPhone?: string } } {
  if (!f.name || !f.email || !f.password || !f.dob || (f.mobile !== undefined && !f.mobile)) {
    return { error: "Please fill all fields!" };
  }
  const nameProblem = validateName(f.name);
  if (nameProblem) return { error: nameProblem };
  if (!EMAIL.test(f.email.trim())) return { error: "Please enter a valid email!" };
  if (f.mobile !== undefined && f.mobile.replace(/\D/g, "").length < 10) return { error: "Please enter a valid mobile number!" };
  const dobProblem = dobError(f.dob);
  if (dobProblem) return { error: dobProblem };
  const pw = validatePassword(f.password, { email: f.email });
  if (pw) return { error: `${pw} ${PASSWORD_HINT}` };

  const minor = isMinorDob(f.dob) === true;
  if (minor) {
    if (!EMAIL.test(f.parentEmail.trim())) return { error: "Enter your parent or guardian's email address." };
    if (f.parentEmail.trim().toLowerCase() === f.email.trim().toLowerCase()) {
      return { error: "The parent email must be different from your own email." };
    }
    if (f.parentPhone.replace(/\D/g, "").length < 10) return { error: "Enter your parent or guardian's 10-digit phone number." };
  }
  return {
    body: {
      name: cleanName(f.name),
      email: f.email.trim(),
      password: f.password,
      dob: f.dob,
      ...(minor ? { parentName: cleanName(f.parentName), parentEmail: f.parentEmail.trim(), parentPhone: f.parentPhone.trim() } : {}),
    },
  };
}
