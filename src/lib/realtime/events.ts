export const ADMIN_CHANNEL = "private-admin";

export const ADMIN_EVENTS = {
  propertyCreated: "property-created",
  propertyUpdated: "property-updated",
  propertyDeleted: "property-deleted",
  leadCreated: "lead-created",
  leadNotificationUpdated: "lead-notification-updated",
} as const;

export type AdminEventName = (typeof ADMIN_EVENTS)[keyof typeof ADMIN_EVENTS];
