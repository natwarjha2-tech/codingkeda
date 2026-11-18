import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "@/components/LegalPage";
import { LEGAL } from "@/app/lib/legal";

export const metadata: Metadata = {
  title: "Terms and Conditions | CodingKida",
  description: "The terms that apply when you use the CodingKida website, mobile app and desktop app.",
};

export default async function TermsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const embed = (await searchParams).embed === "1";
  return (
    <LegalPage title="Terms and Conditions" effective={LEGAL.termsEffective} embed={embed}>
      <p>
        CodingKida (the Platform) is operated by <b>{LEGAL.companyName}</b>, CIN {LEGAL.cin}, registered office at {LEGAL.address}
        {" "}(we, us, our). By creating an account or using the CodingKida website, mobile app or desktop app, you agree to these
        Terms. If you are under 18, your parent or legal guardian must read and accept these Terms for you.
      </p>

      <h2>1. What we do</h2>
      <p>
        CodingKida is an education and educational technology company. We provide education, training, coaching, tutoring, skill
        development and academic support, online, offline or in hybrid form. We also build and run educational technology platforms,
        learning management systems, mobile and desktop applications, digital classrooms, assessment platforms and technology-enabled
        learning tools.
      </p>
      <p>Through the Platform we currently offer:</p>
      <ul>
        <li>Recorded video lessons, live classes, notes and study material</li>
        <li>Coding practice, exercises, quizzes and tests</li>
        <li>A final course test and a completion certificate</li>
        <li>AI-assisted learning help</li>
        <li>Progress reports, including weekly reports for parents or guardians</li>
      </ul>
      <p>
        We may add other services within our business, such as career counselling, corporate training, examinations, certifications
        and partnerships with schools and institutions. Extra terms may apply to them.
      </p>

      <h2>2. Eligibility and parental consent</h2>
      <ul>
        <li>
          A child under 18 may use the Platform only with the consent and supervision of a parent or legal guardian.
        </li>
        <li>
          By registering a child, the parent or guardian confirms that they are the child&apos;s parent or legal guardian, accepts these
          Terms for the child, and consents to our processing of the child&apos;s personal data as described in our{" "}
          <Link href="/privacy">Privacy Policy</Link>.
        </li>
        <li>The parent or guardian is responsible for the child&apos;s use of the Platform.</li>
        <li>
          <b>Parent verification.</b> We ask for your date of birth. If you are under 18, you give your parent or guardian&apos;s email
          address and phone number, and they confirm with a one-time code before you can use the Platform. If you started without
          doing this, you have 14 days to complete it. After that, learning is paused until your parent or guardian is verified.
        </li>
        <li>We may ask for proof of age or of parental consent, and may suspend an account if we cannot confirm it.</li>
      </ul>

      <h2>3. Your account</h2>
      <ul>
        <li>Give accurate information when you register and keep it up to date.</li>
        <li>Keep your password and login codes secret. You are responsible for activity on your account.</li>
        <li>
          <b>Registered devices.</b> An account can be used on up to 2 phones or tablets and 1 computer. A device is registered the
          first time you sign in on it and stays registered after you log out. A different device is refused once these places are
          full. Contact support if you need to change a registered device, for example after you replace or reset your phone or
          computer. The website is not limited.
        </li>
        <li>Do not share, sell, rent or transfer your account or course access.</li>
        <li>Tell us straight away if you think someone else has used your account.</li>
      </ul>

      <h2 id="refunds">4. Courses, fees and payments</h2>
      <ul>
        <li>Some content is free and some is paid. Prices, taxes and what each course includes are shown before you pay.</li>
        <li>Payments are processed by third-party payment providers. We do not store your card or UPI details.</li>
        <li>Access to a paid course starts when payment is confirmed and lasts for the period shown for that course.</li>
        <li>
          <b>Refunds:</b> [Add your refund policy here, including the number of days, any usage limit, and how long a refund takes.]
        </li>
        <li>We may change prices or course content. A change does not affect courses you have already paid for.</li>
      </ul>

      <h2>5. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Copy, record, share, resell or publish our videos, notes, tests, code exercises or other content.</li>
        <li>Share login details, or use bots, scrapers or automated tools on the Platform.</li>
        <li>Cheat in tests, including by getting another person or tool to answer for you or by getting questions in advance.</li>
        <li>Post anything unlawful, harmful, abusive, hateful or sexually explicit, or anything that infringes someone&apos;s rights.</li>
        <li>Harass, bully or contact other students or staff inappropriately.</li>
        <li>Probe, overload, break or reverse-engineer the Platform, or bypass the device limit or any other security feature.</li>
        <li>Run code in the coding editor that attacks or abuses our servers or other people.</li>
      </ul>
      <p>We may remove content, limit features, or suspend or end your account if you break these rules.</p>

      <h2>6. Live classes and recordings</h2>
      <p>
        Live classes may be recorded and made available to enrolled students. By joining, you agree to appear in the recording through
        your name, voice, chat messages and any video you turn on. Do not show private information on your screen or camera. Parents
        should supervise younger children in live sessions.
      </p>

      <h2>7. AI-assisted features</h2>
      <p>
        The Platform includes AI features that explain concepts and help with code. AI answers can be wrong or incomplete. They are a
        study aid, not a replacement for your teacher. Do not type personal details or passwords into the AI chat.
      </p>

      <h2>8. Tests, scores and certificates</h2>
      <ul>
        <li>We award a certificate to learners who meet the pass criteria shown for the course.</li>
        <li>We may withhold or cancel a certificate if we find cheating, misuse or an error in the result.</li>
        <li>A certificate shows that the learner completed our course. It is not a degree or a government-recognised qualification.</li>
      </ul>

      <h2>9. Learning activity and reports</h2>
      <p>
        We record learning activity such as lessons completed, exercises and quizzes attempted, scores and active learning time, to show
        progress and to send reports. Learning time counts only while the learner is actively using a learning screen or watching a
        video. If a parent or guardian gives us a WhatsApp number, we may send weekly progress reports to it. They can ask us to stop at
        any time.
      </p>

      <h2>10. Intellectual property</h2>
      <p>
        All content on the Platform, including videos, notes, code, tests, designs, logos, the CodingKida name and the software, belongs
        to CodingKida or its licensors and is protected by law. We give you a personal, limited, non-exclusive, non-transferable,
        revocable licence to use it for your own learning. Code you write in the editor stays yours. You allow us to store it so we can
        run it and show it back to you.
      </p>

      <h2>11. Privacy and children&apos;s data</h2>
      <p>
        Our <Link href="/privacy">Privacy Policy</Link> explains what personal data we collect, why, who we share it with, and how a
        parent or guardian can review, correct or delete a child&apos;s data. We do not sell personal data and we do not show targeted
        advertising to children.
      </p>

      <h2>12. Deleting your account</h2>
      <p>
        You can delete your account in the app (Profile, then Delete Account) or on the <Link href="/delete-account">delete account page</Link>.
        We send a confirmation code to your email. The account is then scheduled for deletion and kept for 30 days. If you sign in during
        those 30 days, the deletion is cancelled. After 30 days your personal information is erased or anonymised. We keep payment and
        enrolment records, and anonymous learning statistics, where the law requires or for accounting.
      </p>

      <h2>13. Availability and changes</h2>
      <p>
        We try to keep the Platform available but do not promise uninterrupted service. We may update, change, suspend or stop any
        feature or course, for example for maintenance or legal reasons. We will give reasonable notice of major changes where we can.
      </p>

      <h2>14. Suspension and termination</h2>
      <p>
        We may suspend or end your access if you break these Terms, misuse the Platform, give false information, or if the law requires
        it. You may stop using the Platform and delete your account at any time.
      </p>

      <h2>15. Disclaimers and limit of liability</h2>
      <p>
        The Platform and its content are provided as is and as available. We do not guarantee any exam result, grade, job, admission or
        income. Learning results depend on the learner&apos;s own effort. To the extent the law allows, we are not liable for indirect or
        consequential loss or for events outside our reasonable control, and our total liability for a claim about a paid course is
        limited to the amount you paid for that course. Nothing here limits liability that the law does not allow us to limit.
      </p>

      <h2>16. Third-party services</h2>
      <p>
        The Platform uses third-party services such as payment gateways, cloud hosting and video delivery, email and messaging
        providers, and Google sign-in. Their own terms and privacy policies apply to those services.
      </p>

      <h2>17. Changes to these Terms</h2>
      <p>
        We may update these Terms. We will post the new version with a new effective date and notify you in the app or by email about
        important changes. If you keep using the Platform after a change, you accept the updated Terms.
      </p>

      <h2>18. Governing law</h2>
      <p>
        These Terms are governed by the laws of India. Subject to your rights under consumer protection law, the courts at{" "}
        {LEGAL.jurisdiction} have exclusive jurisdiction. Please contact our grievance officer first so we can try to resolve the
        matter.
      </p>

      <h2>19. Grievance officer and contact</h2>
      <p>
        Grievance Officer: {LEGAL.grievanceOfficer}
        <br />
        Email: {LEGAL.supportEmail}
        <br />
        Phone: {LEGAL.phone}
        <br />
        Address: {LEGAL.address}
        <br />
        We acknowledge complaints within 48 hours and aim to resolve them within 15 days.
      </p>
    </LegalPage>
  );
}
