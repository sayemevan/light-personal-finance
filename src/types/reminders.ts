/** Reminder contracts shared by the API route, the client and the SW. */

export type ReminderKind =
  | "loan_due"
  | "loan_overdue"
  | "bill_due"
  | "budget_exceeded"
  | "budget_warning";

export interface ReminderItem {
  /** Stable id (kind + entity + date) so notifications can be deduped. */
  id: string;
  kind: ReminderKind;
  title: string;
  body: string;
  /** In-app path to open when the notification is clicked. */
  url: string;
  /** The relevant date ("YYYY-MM-DD"), or the month ("YYYY-MM") for budgets. */
  date: string;
}

export interface RemindersResponse {
  items: ReminderItem[];
}
