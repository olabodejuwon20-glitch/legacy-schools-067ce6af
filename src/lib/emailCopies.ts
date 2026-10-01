// Email copy templates for LegacySKool
// Each function returns the bodyHtml markup for a specific email.
// Placeholders are interpolated via template literals.

/** Verification code email */
export function verificationBody({ code, expiry }: { code: string; expiry: number }) {
  return `
    <p>Hi,</p>
    <p>Welcome to the LegacySKool community! To securely complete your account setup, please enter the six‑digit verification code below.</p>
    <p style="font-size:24px;font-weight:bold;letter-spacing:2px;text-align:center;">${code}</p>
    <p>This code will expire in <strong>${expiry}</strong> minutes. If you did not attempt to sign in or create an account, you can safely ignore this email.</p>
    <p>Need a hand? Reply directly to this email or reach us at {SUPPORT_EMAIL}.</p>
  `;
}

/** Password reset email */
export function passwordResetBody({ resetLink }: { resetLink: string }) {
  return `
    <p>Hi,</p>
    <p>We received a request to reset the password for your LegacySKool account.</p>
    <p style="margin:20px 0;"><a href="${resetLink}" style="display:inline-block;padding:10px 20px;background:#2C3E50;color:#fff;border-radius:4px;text-decoration:none;">Reset password</a></p>
    <p>This link will expire in <strong>{EXPIRY_MIN}</strong> minutes. If you did not ask to reset your password, please ignore this message. Your account remains secure and your current password will not change.</p>
    <p>If you need assistance, contact us at {SUPPORT_EMAIL}.</p>
  `;
}

/** Onboarding notice (30‑minute) */
export function onboardingNoticeBody({ schoolName }: { schoolName: string }) {
  return `
    <p>Hello,</p>
    <p>We are currently setting up your new LegacySKool portal for <strong>${schoolName}</strong>. Our system is organizing your digital workspace so everything is perfectly in place for your teachers and students.</p>
    <p>This process takes about <strong>30 minutes</strong>. We will send you another email with your direct login link the exact moment it is ready.</p>
    <p>While you wait, you can see how to quickly set up classes and invite your staff in our onboarding guide:</p>
    <p><a href="{FAQ_URL}" style="display:inline-block;padding:10px 20px;background:#2C3E50;color:#fff;border-radius:4px;text-decoration:none;">Learn more</a></p>
    <p>If you have any questions, simply reply to this email or contact us at {SUPPORT_EMAIL}.</p>
  `;
}

/** Portal ready email */
export function portalReadyBody({ portalLink }: { portalLink: string }) {
  return `
    <p>Hi,</p>
    <p>Good news! Your school portal is officially live and ready to use.</p>
    <p>Everything is set up for you to start managing classes, inviting your staff, and welcoming parents to the platform.</p>
    <p><a href="${portalLink}" style="display:inline-block;padding:10px 20px;background:#2C3E50;color:#fff;border-radius:4px;text-decoration:none;">Go to portal</a></p>
    <p>If you need a quick refresher on where to begin, you can always visit our helpful setup guide at {FAQ_URL}.</p>
    <p>We are glad to have you with us. If you need support along the way, we are always here at {SUPPORT_EMAIL}.</p>
  `;
}

/** Feature Spotlight */
export function featureSpotlightBody({ featureName, ctaLink }: { featureName: string; ctaLink: string }) {
  return `
    <p>Hi,</p>
    <p>We’ve just added <strong>${featureName}</strong> to make managing your school even easier.</p>
    <ul>
      <li>Save time on your daily administrative tasks.</li>
      <li>It is simple to set up and ready to use right away.</li>
      <li>Keep everything organized securely in one place.</li>
    </ul>
    <p><a href="${ctaLink}" style="display:inline-block;padding:10px 20px;background:#2C3E50;color:#fff;border-radius:4px;text-decoration:none;">Try it now</a></p>
    <p>If you’d rather not receive updates, you can unsubscribe here: {UNSUBSCRIBE_URL}</p>
    <p>Questions? Email us at {SUPPORT_EMAIL}.</p>
  `;
}

/** Seasonal Campaign */
export function seasonalCampaignBody({ ctaLink }: { ctaLink: string }) {
  return `
    <p>Hello,</p>
    <p>A new term is right around the corner, and we want to ensure your school is fully prepared.</p>
    <ul>
      <li>Update your class rosters in just a few clicks.</li>
      <li>Share the new timetable with your teachers and parents.</li>
      <li>Easily set up your fee structures for the term ahead.</li>
    </ul>
    <p><a href="${ctaLink}" style="display:inline-block;padding:10px 20px;background:#2C3E50;color:#fff;border-radius:4px;text-decoration:none;">Explore the dashboard</a></p>
    <p>If you’d rather not receive updates, you can unsubscribe here: {UNSUBSCRIBE_URL}</p>
    <p>Questions? Reach us at {SUPPORT_EMAIL}.</p>
  `;
}

/** Referral Program */
export function referralProgramBody({ referralLink }: { referralLink: string }) {
  return `
    <p>Hi,</p>
    <p>Do you know another school that could benefit from LegacySKool? We would love to welcome them.</p>
    <ul>
      <li>Share your unique invite link with other school administrators.</li>
      <li>Help them transition smoothly to digital management.</li>
      <li>Grow a community of forward‑thinking schools.</li>
    </ul>
    <p><a href="${referralLink}" style="display:inline-block;padding:10px 20px;background:#2C3E50;color:#fff;border-radius:4px;text-decoration:none;">Invite a colleague</a></p>
    <p>If you’d rather not receive updates, you can unsubscribe here: {UNSUBSCRIBE_URL}</p>
    <p>Questions? Email us at {SUPPORT_EMAIL}.</p>
  `;
}

/** 4-Week Marketing Campaign Series */
export function campaignWeek1WelcomeBody({ schoolName, guideLink }: { schoolName: string; guideLink?: string }) {
  return onboardingNoticeBody({ schoolName });
}

export function campaignWeek2AttendanceBody({ ctaLink }: { ctaLink: string }) {
  return `
    <p>Hello School Administrator,</p>
    <p>Tracking daily classroom attendance no longer needs to involve bulky paper registers and missing sheets.</p>
    <p>With LegacySKool's Attendance Module:</p>
    <ul>
      <li>Teachers mark attendance in seconds directly from their mobile phones.</li>
      <li>Automated SMS and in-app alerts keep parents informed of truancy or late arrivals.</li>
      <li>Principals get real-time school-wide attendance summaries and term heatmaps.</li>
    </ul>
    <p style="margin:24px 0;">
      <a href="${ctaLink}" style="display:inline-block;padding:12px 24px;background:#2C3E50;color:#ffffff;border-radius:6px;text-decoration:none;font-weight:600;">Explore Attendance</a>
    </p>
    <p>Help your teachers reclaim valuable teaching hours today.</p>
    <p>Warm regards,<br/>The LegacySKool Team</p>
  `;
}

export function campaignWeek3BackToSchoolBody({ ctaLink, discount = "15%" }: { ctaLink: string; discount?: string }) {
  return `
    <p>Hello School Leader,</p>
    <p>As you prepare for the upcoming school term, we want to help your school transition smoothly into full digital management.</p>
    <p>Enjoy our exclusive <strong>Back-to-School Bundle with ${discount} off</strong> on all termly subscription plans:</p>
    <ul>
      <li>Complete Computer-Based Testing (CBT) with JAMB & NECO question banks.</li>
      <li>Automated terminal report cards with printable QR verification.</li>
      <li>Integrated school fee collection and parent payment tracking.</li>
      <li>Complimentary hands-on staff onboarding and training.</li>
    </ul>
    <p style="margin:24px 0;">
      <a href="${ctaLink}" style="display:inline-block;padding:12px 24px;background:#2C3E50;color:#ffffff;border-radius:6px;text-decoration:none;font-weight:600;">Claim Offer</a>
    </p>
    <p>This limited-time offer helps you start the term organized and stress-free.</p>
    <p>Best wishes,<br/>The LegacySKool Team</p>
  `;
}

export function campaignWeek4ReferralBody({ referralLink, credits = "pilot credits" }: { referralLink: string; credits?: string }) {
  return `
    <p>Hello Educator,</p>
    <p>Great schools grow together. When you invite fellow school administrators and principals to LegacySKool, everyone benefits.</p>
    <p>Through our Colleague Referral Program:</p>
    <ul>
      <li>Share your personalized school invite link with principals and educators in your network.</li>
      <li>When your referred school joins, your school earns valuable <strong>${credits}</strong> towards your active plan.</li>
      <li>Your colleagues receive dedicated onboarding assistance and priority support.</li>
    </ul>
    <p style="margin:24px 0;">
      <a href="${referralLink}" style="display:inline-block;padding:12px 24px;background:#2C3E50;color:#ffffff;border-radius:6px;text-decoration:none;font-weight:600;">Invite Now</a>
    </p>
    <p>Thank you for championing modern school administration across Africa.</p>
    <p>With appreciation,<br/>The LegacySKool Team</p>
  `;
}

/** Payment receipt */
export function paymentReceiptBody({ invoiceNumber, studentName, paymentMethod, breakdownTable, pdfLink }: { invoiceNumber: string; studentName: string; paymentMethod: string; breakdownTable: string; pdfLink: string }) {
  return `
    <p>Hello,</p>
    <p>We have safely received your payment. Below are your payment details:</p>
    <p><strong>Invoice #:</strong> ${invoiceNumber}<br/>
       <strong>Student:</strong> ${studentName}<br/>
       <strong>Payment method:</strong> ${paymentMethod}</p>
    ${breakdownTable}
    <p>You can download a PDF copy of this receipt for your records here: <a href="${pdfLink}">${pdfLink}</a></p>
    <p>If you have any questions about this receipt, please contact us at {SUPPORT_EMAIL}.</p>
  `;
}

/** Invoice / billing statement */
export function invoiceBody({ invoiceNumber, paymentMethod, breakdownTable, pdfLink }: { invoiceNumber: string; paymentMethod: string; breakdownTable: string; pdfLink: string }) {
  return `
    <p>Hello,</p>
    <p>Your latest invoice is now ready for review.</p>
    <p><strong>Invoice #:</strong> ${invoiceNumber}<br/>
       <strong>Payment method:</strong> ${paymentMethod}</p>
    ${breakdownTable}
    <p>You can download a PDF copy of this invoice here: <a href="${pdfLink}">${pdfLink}</a></p>
    <p>If you have any questions regarding your billing statement, please contact us at {SUPPORT_EMAIL}.</p>
  `;
}

/** Subscription activated */
export function subscriptionActivatedBody({ planName, startDate, endDate, price, dashboardLink }: { planName: string; startDate: string; endDate: string; price: string; dashboardLink: string }) {
  return `
    <p>Hi,</p>
    <p>Great news! Your <strong>${planName}</strong> subscription is now active as of ${startDate}.</p>
    <p>- Renewal date: ${endDate}<br/>- Amount paid: ${price}</p>
    <p>You can start using all your premium features right away by visiting your dashboard:</p>
    <p><a href="${dashboardLink}" style="display:inline-block;padding:10px 20px;background:#2C3E50;color:#fff;border-radius:4px;text-decoration:none;">Go to dashboard</a></p>
    <p>If you need help setting up your portal, our support team is ready to assist.</p>
    <p>Questions? Email us at {SUPPORT_EMAIL}.</p>
  `;
}

/** Add‑on purchase */
export function addonPurchaseBody({ addonName, startDate, price, dashboardLink }: { addonName: string; startDate: string; price: string; dashboardLink: string }) {
  return `
    <p>Hi,</p>
    <p>Thank you for upgrading! Your new <strong>${addonName}</strong> module is now active and added to your account.</p>
    <p>- Activation date: ${startDate}<br/>- Amount paid: ${price}</p>
    <p>You can configure this new feature immediately from your admin dashboard:</p>
    <p><a href="${dashboardLink}" style="display:inline-block;padding:10px 20px;background:#2C3E50;color:#fff;border-radius:4px;text-decoration:none;">Go to dashboard</a></p>
    <p>If you need help setting up your new add‑on, our help centre is always available.</p>
    <p>Questions? Email us at {SUPPORT_EMAIL}.</p>
  `;
}

/** Account deletion confirmation */
export function accountDeletionBody() {
  return `
    <p>Hello,</p>
    <p>We are writing to confirm that your LegacySKool account has been successfully deleted, exactly as you requested.</p>
    <p>All of your personal information has been safely removed from our active systems. We are sorry to see you go. If you ever need to return, you are always welcome back.</p>
    <p>Questions? Email us at {SUPPORT_EMAIL}.</p>
  `;
}

/** Data export ready */
export function dataExportReadyBody({ exportLink, expiry }: { exportLink: string; expiry: number }) {
  return `
    <p>Hi,</p>
    <p>The data export you requested is now complete and ready for download.</p>
    <p><a href="${exportLink}" style="display:inline-block;padding:10px 20px;background:#2C3E50;color:#fff;border-radius:4px;text-decoration:none;">Download your data</a></p>
    <p>For your security, this link will automatically expire in <strong>${expiry}</strong> minutes. Please store your downloaded files safely.</p>
    <p>Questions? Reach us at {SUPPORT_EMAIL}.</p>
  `;
}

/** Trial ending reminder */
export function trialEndingReminderBody({ endDate, dashboardLink }: { endDate: string; dashboardLink: string }) {
  return `
    <p>Hi,</p>
    <p>We hope you are enjoying your time with LegacySKool. Your free trial will expire on ${endDate}.</p>
    <p>To ensure your school does not lose access to these features, please choose a plan before your trial ends.</p>
    <p><a href="${dashboardLink}" style="display:inline-block;padding:10px 20px;background:#2C3E50;color:#fff;border-radius:4px;text-decoration:none;">Go to dashboard</a></p>
    <p>If you need help choosing the right plan for your school, we are happy to assist.</p>
    <p>Questions? Email us at {SUPPORT_EMAIL}.</p>
  `;
}
