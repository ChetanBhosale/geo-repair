import type { ReactElement } from "react"

import AccountWelcome, {
  type AccountWelcomeProps,
} from "./templates/AccountWelcome"
import ChatLimitReached, {
  type ChatLimitReachedProps,
} from "./templates/ChatLimitReached"
import CheckupComplete, {
  type CheckupCompleteProps,
} from "./templates/CheckupComplete"
import ContactAck, { type ContactAckProps } from "./templates/ContactAck"
import ContactNotification, {
  type ContactNotificationProps,
} from "./templates/ContactNotification"
import FixFailed, { type FixFailedProps } from "./templates/FixFailed"
import FixPlanReady, {
  type FixPlanReadyProps,
} from "./templates/FixPlanReady"
import FixPrOpened, { type FixPrOpenedProps } from "./templates/FixPrOpened"
import PaymentFailed, {
  type PaymentFailedProps,
} from "./templates/PaymentFailed"
import PaymentReceipt, {
  type PaymentReceiptProps,
} from "./templates/PaymentReceipt"
import Refund, { type RefundProps } from "./templates/Refund"
import ScanFailed, { type ScanFailedProps } from "./templates/ScanFailed"
import WaitlistWelcome, {
  type WaitlistWelcomeProps,
} from "./templates/WaitlistWelcome"

// Maps every template's props type to its id. Adding a template means adding one
// entry here + one in TEMPLATES below; the two are kept in sync by the types.
export type TemplatePropsMap = {
  waitlistWelcome: WaitlistWelcomeProps
  contactNotification: ContactNotificationProps
  contactAck: ContactAckProps
  accountWelcome: AccountWelcomeProps
  checkupComplete: CheckupCompleteProps
  scanFailed: ScanFailedProps
  paymentReceipt: PaymentReceiptProps
  paymentFailed: PaymentFailedProps
  refund: RefundProps
  fixPlanReady: FixPlanReadyProps
  fixPrOpened: FixPrOpenedProps
  fixFailed: FixFailedProps
  chatLimitReached: ChatLimitReachedProps
}

export type TemplateId = keyof TemplatePropsMap

type TemplateEntry<P> = {
  /** The React Email component. */
  component: (props: P) => ReactElement
  /** Subject line, computed from the same props. */
  subject: (props: P) => string
  /** Sample props used for the preview server and the test-send script. */
  sample: P
}

// `as` casts bridge each component's default-export signature (P => Element)
// to the entry shape; PreviewProps is the per-template sample data.
export const TEMPLATES: {
  [K in TemplateId]: TemplateEntry<TemplatePropsMap[K]>
} = {
  waitlistWelcome: {
    component: WaitlistWelcome,
    subject: () => `You're on the GEO Repair waitlist`,
    sample: WaitlistWelcome.PreviewProps,
  },
  contactNotification: {
    component: ContactNotification,
    subject: (p) => `Contact form: ${p.name || p.email}`,
    sample: ContactNotification.PreviewProps,
  },
  contactAck: {
    component: ContactAck,
    subject: () => `Thanks for contacting GEO Repair`,
    sample: ContactAck.PreviewProps,
  },
  accountWelcome: {
    component: AccountWelcome,
    subject: () => `Welcome to GEO Repair`,
    sample: AccountWelcome.PreviewProps,
  },
  checkupComplete: {
    component: CheckupComplete,
    subject: (p) => `Your AI search checkup for ${p.websiteUrl} is ready`,
    sample: CheckupComplete.PreviewProps,
  },
  scanFailed: {
    component: ScanFailed,
    subject: (p) => `We couldn't finish the checkup for ${p.websiteUrl}`,
    sample: ScanFailed.PreviewProps,
  },
  paymentReceipt: {
    component: PaymentReceipt,
    subject: (p) => `Your ${p.tier} payment is confirmed`,
    sample: PaymentReceipt.PreviewProps,
  },
  paymentFailed: {
    component: PaymentFailed,
    subject: (p) => `Your ${p.tier} payment didn't go through`,
    sample: PaymentFailed.PreviewProps,
  },
  refund: {
    component: Refund,
    subject: (p) => `Your ${p.tier} refund is on its way`,
    sample: Refund.PreviewProps,
  },
  fixPlanReady: {
    component: FixPlanReady,
    subject: (p) => `Your fix plan for ${p.projectName} is ready to review`,
    sample: FixPlanReady.PreviewProps,
  },
  fixPrOpened: {
    component: FixPrOpened,
    subject: (p) => `Your pull request for ${p.projectName} is open`,
    sample: FixPrOpened.PreviewProps,
  },
  fixFailed: {
    component: FixFailed,
    subject: (p) => `The fix run for ${p.projectName} didn't finish`,
    sample: FixFailed.PreviewProps,
  },
  chatLimitReached: {
    component: ChatLimitReached,
    subject: (p) => `You've reached the chat limit for ${p.projectName}`,
    sample: ChatLimitReached.PreviewProps,
  },
}
