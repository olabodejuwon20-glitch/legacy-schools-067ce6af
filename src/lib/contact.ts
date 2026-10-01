// Official support channels
export const SUPPORT_EMAIL = "nexolabsa@gmail.com";
// E.164 (no spaces, no plus) for wa.me links.
export const SUPPORT_WHATSAPP = "2349136284262";
export const SUPPORT_WHATSAPP_DISPLAY = "+234 9136284262";
export const SUPPORT_SLA = "We respond within 4 working hours.";

export const waLink = (msg = "Hi LegacySKool, I'd like to learn more.") =>
  `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(msg)}`;

export const mailtoOnboard = () =>
  `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("School onboarding request")}&body=${encodeURIComponent("School name:\nContact name:\nPhone:\nNumber of students:\nNotes:\n")}`;

export const mailtoDemo = () =>
  `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Book a demo")}&body=${encodeURIComponent("School name:\nPreferred date/time:\nContact phone:\n")}`;

export const mailtoRefer = () =>
  `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("School referral")}&body=${encodeURIComponent("Referred school name:\nContact person:\nPhone / email:\nYour name:\nYour school:\n")}`;
