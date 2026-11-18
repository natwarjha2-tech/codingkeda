import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "@/components/LegalPage";
import { LEGAL } from "@/app/lib/legal";

export const metadata: Metadata = {
  title: "Privacy Policy | CodingKida",
  description: "What personal data CodingKida collects from students and parents, why, and how to delete it.",
};

export default async function PrivacyPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const embed = (await searchParams).embed === "1";
  return (
    <LegalPage title="Privacy Policy" effective={LEGAL.privacyEffective} embed={embed}>
      <p>
        This policy explains how <b>{LEGAL.companyName}</b> (CodingKida, we, us) collects, uses, shares and protects personal data when
        you use the CodingKida website, mobile app and desktop app. CodingKida is a learning platform used by children, so we collect
        only what we need and we treat a child&apos;s data with extra care. We act in line with the Digital Personal Data Protection Act,
        2023 and the Information Technology Act, 2000.
      </p>

      <h2>1. Children and parental consent</h2>
      <ul>
        <li>A child under 18 may use CodingKida only with the consent of a parent or legal guardian.</li>
        <li>By registering a child, the parent or guardian consents to the collection and use of the child&apos;s data as described here.</li>
        <li>
          We check this consent. For a student under 18 we collect the date of birth and the parent or guardian&apos;s name, email and
          phone number, and we send a one-time code to the parent&apos;s email (and to their WhatsApp) that the parent must confirm. Until
          it is confirmed, the student can use the Platform for a limited time only.
        </li>
        <li>We do not show targeted advertising to children, we do not track children for advertising, and we do not sell personal data.</li>
        <li>A parent or guardian can ask to see, correct or delete their child&apos;s data, or withdraw consent, at any time (see section 8).</li>
      </ul>

      <h2>2. What we collect</h2>
      <table>
        <thead>
          <tr><th>Data</th><th>Why we collect it</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>Name, email, password (stored only as a one-way hash), Google account link if you use Google sign-in, profile photo</td>
            <td>To create and secure the account and sign you in</td>
          </tr>
          <tr>
            <td>Phone number, school, birthday, gender (optional profile fields)</td>
            <td>To personalise learning and contact you about your course</td>
          </tr>
          <tr>
            <td>Parent or guardian name, email and phone or WhatsApp number</td>
            <td>To get and check the parent&apos;s consent (one-time codes), send progress reports and contact the family</td>
          </tr>
          <tr>
            <td>Learning activity: lessons completed, exercises, quizzes, test scores, active learning time, certificates</td>
            <td>To show progress, run the final test, issue certificates and send reports</td>
          </tr>
          <tr>
            <td>Code you write in the editor and messages you send in the AI chat and live-class chat</td>
            <td>To run your code, give learning help, and show your work back to you</td>
          </tr>
          <tr>
            <td>Device information: a device ID (on Android, the Android ID, which is not linked to advertising), device type (phone or computer), device name, platform, app version and last-used time. Push notification token</td>
            <td>To enforce the one-device-at-a-time rule, protect the account, and send notifications</td>
          </tr>
          <tr>
            <td>Payments and enrolments: course, amount, payment status and reference. We do not receive or store your card or UPI details</td>
            <td>To give you course access and keep accounting records</td>
          </tr>
          <tr>
            <td>Live-class recordings, including your name, voice, chat and any video you turn on</td>
            <td>To let enrolled students watch the class again</td>
          </tr>
          <tr>
            <td>Survey answers and support messages</td>
            <td>To improve our courses and help you</td>
          </tr>
          <tr>
            <td>Technical logs such as IP address and error reports</td>
            <td>To keep the service secure and fix problems</td>
          </tr>
        </tbody>
      </table>
      <p>The apps ask for permissions only for features you use, such as notifications, and storage for offline downloads.</p>

      <h2>3. How we use data</h2>
      <ul>
        <li>To provide courses, live classes, tests and certificates.</li>
        <li>To show progress and send reports to the student and the parent or guardian.</li>
        <li>To process payments and prevent fraud and account sharing.</li>
        <li>To send service messages, such as login codes, new-device alerts, class reminders and account notices.</li>
        <li>To keep the platform safe and to improve it.</li>
      </ul>

      <h2>4. Who we share data with</h2>
      <p>We do not sell personal data. We share it only with service providers that help us run CodingKida, under their own security obligations:</p>
      <ul>
        <li>Cloud hosting, database, file storage and video delivery providers</li>
        <li>Live-class video provider</li>
        <li>Payment gateway providers</li>
        <li>Email, push-notification and WhatsApp messaging providers</li>
        <li>Google, if you choose Google sign-in</li>
      </ul>
      <p>
        We may also disclose data when the law or a court requires it, or to protect the safety of a child or the Platform. Some providers
        process data on servers outside India.
      </p>

      <h2>5. How long we keep data</h2>
      <ul>
        <li>We keep account and learning data while your account is active.</li>
        <li>
          When you delete your account, it is scheduled for deletion and kept for 30 days in case you change your mind. After that we
          erase or anonymise your personal information (see section 8).
        </li>
        <li>We keep payment and enrolment records for as long as tax and accounting law requires.</li>
        <li>Anonymous learning statistics that no longer identify anyone may be kept.</li>
      </ul>

      <h2>6. Security</h2>
      <p>
        Passwords are stored as hashes. Data is sent over encrypted connections. Access to student data is limited to staff who need it,
        and each account can be signed in on one device at a time. No system is perfectly secure. If a data breach affects you, we will
        tell you and the authorities as the law requires.
      </p>

      <h2>7. Cookies and similar storage</h2>
      <p>
        The website and apps store a sign-in token and basic settings on your device so you stay signed in and the app works. We do not use
        advertising cookies.
      </p>

      <h2>8. Your rights, and deleting your data</h2>
      <p>You or, for a child, the parent or guardian can:</p>
      <ul>
        <li>Ask to see the personal data we hold.</li>
        <li>Ask us to correct wrong data.</li>
        <li>Withdraw consent.</li>
        <li>
          Delete the account. In the app go to Profile, then Delete Account, or use the{" "}
          <Link href="/delete-account">delete account page</Link>. You confirm with a code sent to your email. After 30 days the account
          is permanently erased or anonymised: name, email, password, photo, phone, school, birthday, parent details, devices, push tokens,
          notifications, chat messages and saved code. Certificates stay on record under the name Deleted user. We keep payments,
          enrolments and anonymous learning statistics.
        </li>
        <li>Make a complaint to our grievance officer, and to the Data Protection Board of India if we do not resolve it.</li>
      </ul>
      <p>To use any of these rights, write to {LEGAL.privacyEmail}. We reply within 30 days.</p>

      <h2>9. Changes to this policy</h2>
      <p>
        We may update this policy. We will post the new version with a new effective date and tell you in the app or by email about
        important changes.
      </p>

      <h2>10. Contact and grievance officer</h2>
      <p>
        {LEGAL.companyName}
        <br />
        {LEGAL.address}
        <br />
        Grievance Officer: {LEGAL.grievanceOfficer}
        <br />
        Email: {LEGAL.privacyEmail}
        <br />
        Phone: {LEGAL.phone}
      </p>
      <p>
        See also our <Link href="/terms">Terms and Conditions</Link>.
      </p>
    </LegalPage>
  );
}
