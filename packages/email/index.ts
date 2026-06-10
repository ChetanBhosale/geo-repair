// @repo/email — shared transactional email package.
//
// Phase 1: React Email templates + a low-level send/render API. The product
// wiring (presence-aware suppression, backend triggers, billing webhooks,
// migrating the live waitlist/contact routes) is deferred to later phases.

export { send, type SendResult } from "./src/client"
export { renderEmail } from "./src/render"
export { sendEmail } from "./src/send"
export {
  TEMPLATES,
  type TemplateId,
  type TemplatePropsMap,
} from "./src/registry"
export { SITE } from "./src/theme"
