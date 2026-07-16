import { createServerFn } from "@tanstack/react-start";
import { newCollectionServerSchema } from "./collection-schema";
import { insertCollection, readDashboardData } from "./revenue.server";

export const getDashboardData = createServerFn({ method: "GET" }).handler(() =>
  readDashboardData(),
);

export const createCollection = createServerFn({ method: "POST" })
  .validator(newCollectionServerSchema)
  .handler(({ data }) => insertCollection(data));
