import { createActivityLog } from "./firestore.service";

type ActivityInput = {
  actorId?: string;
  internId?: string;
  entity: string;
  entityId?: string;
  action: string;
  metadata?: Record<string, unknown>;
};

export async function logActivity(input: ActivityInput) {
  return createActivityLog(input);
}

