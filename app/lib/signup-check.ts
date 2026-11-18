/**
 * The checks every website sign-up form runs before calling /api/auth/signup
 * (the server repeats them). Browser-safe: no server imports.
 * Returns the problem (message + which field), or the body to send.
 */
import { validateName, cleanName } from "@/app/lib/name";
import { dobError, isMinorDob } from "@/app/lib/age";
import { validatePassword, PASSWORD_HINT } from "@/app/lib/password-rules";
import { fieldFromMessage, type SignupField } from "@/app/lib/signup-errors";

export interface SignupInput {
  name: string;
  email: string;
  mobile?: string; // only some forms ask for it
  password: string;
  dob: string;
  studentClass: string;
  school: string;
  /** The "I agree to the Terms & Privacy Policy" box (unticked by default). */
  agreed: boolean;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Body = {
  name: string; email: string; password: string; dob: string;
  studentClass: string; school: string; acceptedTerms: true;
  parentName?: string; parentEmail?: string; parentPhone?: string;
};

export function checkSignup(f: SignupInput): { error: string; field: SignupField } | { body: Body } {
  const fail = (error: string, field: SignupField = fieldFromMessage(error)) => ({ error, field });

  // Empty fields, in the order they appear on the form.
  if (!f.name.trim()) return fail("Please enter your full name.", "name");
  if (!f.email.trim()) return fail("Please enter your email address.", "email");
  if (f.mobile !== undefined && !f.mobile.trim()) return fail("Please enter your mobile number.", "mobile");
  if (!f.password) return fail("Please choose a password.", "password");
  if (!f.dob) return fail("Please enter your date of birth.", "dob");

  const nameProblem = validateName(f.name);
  if (nameProblem) return fail(nameProblem, "name");
  if (!EMAIL.test(f.email.trim())) return fail("Please enter a valid email address, for example name@gmail.com.", "email");
  if (f.mobile !== undefined && f.mobile.replace(/\D/g, "").length < 10) {
    return fail("Please enter a valid 10-digit mobile number.", "mobile");
  }
  const pw = validatePassword(f.password, { email: f.email });
  if (pw) return fail(`${pw} ${PASSWORD_HINT}`, "password");
  const dobProblem = dobError(f.dob);
  if (dobProblem) return fail(dobProblem, "dob");
  if (!f.studentClass.trim()) return fail("Select your class.", "studentClass");
  if (f.school.trim().length < 2) return fail("Enter your school name.", "school");

  const minor = isMinorDob(f.dob) === true;
  if (minor) {
    if (!f.parentName.trim()) return fail("Please enter your parent or guardian's name.", "parentName");
    if (!EMAIL.test(f.parentEmail.trim())) return fail("Enter your parent or guardian's email address.", "parentEmail");
    if (f.parentEmail.trim().toLowerCase() === f.email.trim().toLowerCase()) {
      return fail("The parent email must be different from your own email.", "parentEmail");
    }
    if (f.parentPhone.replace(/\D/g, "").length < 10) {
      return fail("Enter your parent or guardian's 10-digit phone number.", "parentPhone");
    }
  }
  if (!f.agreed) return fail("Please read and accept the Terms & Conditions and Privacy Policy.", "terms");
  return {
    body: {
      name: cleanName(f.name),
      email: f.email.trim(),
      password: f.password,
      dob: f.dob,
      studentClass: f.studentClass.trim(),
      school: f.school.replace(/\s+/g, " ").trim(),
      acceptedTerms: true,
      ...(minor ? { parentName: cleanName(f.parentName), parentEmail: f.parentEmail.trim(), parentPhone: f.parentPhone.trim() } : {}),
    },
  };
}
