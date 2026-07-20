import { createServerFn } from "@tanstack/react-start";
import {
  getAccessibleDepartments,
  isAdminRole,
  requireDepartmentPermission,
  requireRevenuePermission,
} from "../auth/auth.server";
import { assertCollectionDatesOpen } from "../closure/closure.server";
import { publishCollectionChanged } from "./collection-events.server";
import {
  clinicDateKey,
  dashboardQuerySchema,
  defaultDashboardQuery,
  validateCollectionDate,
  validateDashboardRange,
} from "./collection-query";
import {
  collectionBatchSchema,
  editCollectionSchema,
  patientWorkspaceUpdateSchema,
} from "./collection-schema";
import {
  findCollectionForAuthorization,
  findPatientCollectionsForAuthorization,
  insertCollectionBatch,
  isTodayInClinicTime,
  readDashboardData,
  updateCollection as updateCollectionRecord,
  updatePatientWorkspace as updatePatientWorkspaceRecord,
} from "./revenue.server";

export const getDashboardData = createServerFn({ method: "GET" })
  .validator(dashboardQuerySchema)
  .handler(async ({ data }) => {
    const session = await requireRevenuePermission("read");
    const isAdmin = isAdminRole(session.user.role);
    const query = validateDashboardRange(data, isAdmin);
    const accessibleDepartments = await getAccessibleDepartments(
      session.user.id,
      session.user.role,
    );
    return {
      dashboard: await readDashboardData(accessibleDepartments, isAdmin, query),
      session,
    };
  });

export const initialDashboardQuery = defaultDashboardQuery();

export const createCollectionBatch = createServerFn({ method: "POST" })
  .validator(collectionBatchSchema)
  .handler(async ({ data }) => {
    const session = await requireRevenuePermission("create");
    const isAdmin = isAdminRole(session.user.role);
    validateCollectionDate(data.occurredOn, isAdmin);
    await assertCollectionDatesOpen([data.occurredOn]);

    await Promise.all(
      data.payments.map((payment) =>
        requireDepartmentPermission(
          session.user.id,
          payment.department,
          "create",
          session.user.role,
        ),
      ),
    );

    const accessibleDepartments = await getAccessibleDepartments(
      session.user.id,
      session.user.role,
    );
    const dashboard = await insertCollectionBatch(
      data,
      session.user.id,
      accessibleDepartments,
      isAdmin,
    );
    publishCollectionChanged();
    return dashboard;
  });

export const updateCollection = createServerFn({ method: "POST" })
  .validator(editCollectionSchema)
  .handler(async ({ data }) => {
    const payment = await findCollectionForAuthorization(data.id);
    if (!payment) {
      throw new Response("Collection not found.", { status: 404 });
    }
    await assertCollectionDatesOpen([clinicDateKey(payment.occurredAt)]);

    const action = isTodayInClinicTime(payment.occurredAt) ? "edit-current" : "edit-history";
    const session = await requireRevenuePermission(action);
    await requireDepartmentPermission(
      session.user.id,
      payment.department,
      action,
      session.user.role,
    );

    const accessibleDepartments = await getAccessibleDepartments(
      session.user.id,
      session.user.role,
    );
    const dashboard = await updateCollectionRecord(
      data,
      accessibleDepartments,
      isAdminRole(session.user.role),
    );
    publishCollectionChanged();
    return dashboard;
  });

export const updatePatientWorkspace = createServerFn({ method: "POST" })
  .validator(patientWorkspaceUpdateSchema)
  .handler(async ({ data }) => {
    const session = await requireRevenuePermission("read");
    const isAdmin = isAdminRole(session.user.role);
    const collectionIds = data.collections.map((collection) => collection.id);
    const storedCollections = await findPatientCollectionsForAuthorization(
      data.customerId,
      collectionIds,
    );
    if (storedCollections.length !== collectionIds.length) {
      throw new Response("One or more patient collections were not found.", { status: 404 });
    }
    await assertCollectionDatesOpen([
      ...storedCollections.map((collection) => clinicDateKey(collection.occurredAt)),
      ...data.newCollections.map((collection) => collection.occurredOn),
    ]);

    if (storedCollections.length > 0) {
      const hasHistoricalCollection = storedCollections.some(
        (collection) => !isTodayInClinicTime(collection.occurredAt),
      );
      const action = hasHistoricalCollection ? "edit-history" : "edit-current";
      await requireRevenuePermission(action);
      const requestedCollections = new Map(
        data.collections.map((collection) => [collection.id, collection]),
      );

      await Promise.all(
        storedCollections.flatMap((stored) => {
          const requested = requestedCollections.get(stored.id);
          if (!requested) return [];
          return [
            requireDepartmentPermission(
              session.user.id,
              stored.department,
              action,
              session.user.role,
            ),
            requireDepartmentPermission(
              session.user.id,
              requested.department,
              action,
              session.user.role,
            ),
          ];
        }),
      );
    }

    if (data.newCollections.length > 0) {
      await requireRevenuePermission("create");
      await Promise.all(
        data.newCollections.map((collection) => {
          validateCollectionDate(collection.occurredOn, isAdmin);
          return requireDepartmentPermission(
            session.user.id,
            collection.department,
            "create",
            session.user.role,
          );
        }),
      );
    }

    const accessibleDepartments = await getAccessibleDepartments(
      session.user.id,
      session.user.role,
    );
    const dashboard = await updatePatientWorkspaceRecord(
      data,
      session.user.id,
      accessibleDepartments,
      isAdmin,
    );
    publishCollectionChanged();
    return dashboard;
  });
