import { createServerFn } from "@tanstack/react-start";
import { requireDepartmentPermission, requireRevenuePermission } from "../auth/auth.server";
import { readOpticalTracker, updateOpticalOrderStatus } from "./optical.server";
import { updateOpticalOrderSchema } from "./optical-schema";

export const getOpticalTracker = createServerFn({ method: "GET" }).handler(async () => {
  const session = await requireRevenuePermission("read");
  await requireDepartmentPermission(session.user.id, "Opticals", "view", session.user.role);
  return {
    session,
    tracker: await readOpticalTracker(),
  };
});

export const setOpticalOrderStatus = createServerFn({ method: "POST" })
  .validator(updateOpticalOrderSchema)
  .handler(async ({ data }) => {
    const session = await requireRevenuePermission("read");
    await requireDepartmentPermission(
      session.user.id,
      "Opticals",
      "edit-current",
      session.user.role,
    );
    return updateOpticalOrderStatus(data, session.user.id);
  });
