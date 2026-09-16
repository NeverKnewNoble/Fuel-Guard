import { defineRelations } from "drizzle-orm";

import * as schema from "./schema";

// Relation names must not match column names (e.g. `recorder`, not `recordedBy`).

export const relations = defineRelations(schema, (r) => ({
  sites: {
    users: r.many.users(),
    operators: r.many.operators(),
    equipment: r.many.equipment(),
    tanks: r.many.tanks(),
    fuelEntries: r.many.fuelEntries(),
    theftAlerts: r.many.theftAlerts(),
  },

  users: {
    site: r.one.sites({ from: r.users.siteId, to: r.sites.id }),
    inviter: r.one.users({ from: r.users.invitedBy, to: r.users.id, alias: "invitedBy" }),
    invitees: r.many.users({ alias: "invitedBy" }),
    operator: r.one.operators({ from: r.users.id, to: r.operators.userId }),
    recordedFuelEntries: r.many.fuelEntries(),
    receivedIntakes: r.many.tankIntakes(),
    voidedIntakes: r.many.tankIntakes({ alias: "voidedIntakes" }),
    voidedFuelEntries: r.many.fuelEntries({ alias: "voidedEntries" }),
    tankDips: r.many.tankDips(),
    requestedCorrections: r.many.fuelEntryCorrections({ alias: "requestedBy" }),
    reviewedCorrections: r.many.fuelEntryCorrections({ alias: "reviewedBy" }),
    resolvedAlerts: r.many.theftAlerts(),
    alertReads: r.many.alertReads(),
    auditLog: r.many.auditLog(),
  },

  operators: {
    site: r.one.sites({ from: r.operators.siteId, to: r.sites.id }),
    user: r.one.users({ from: r.operators.userId, to: r.users.id }),
    fuelEntries: r.many.fuelEntries(),
  },

  equipmentTypes: {
    equipment: r.many.equipment(),
  },

  equipment: {
    type: r.one.equipmentTypes({
      from: r.equipment.equipmentTypeId,
      to: r.equipmentTypes.id,
      optional: false,
    }),
    site: r.one.sites({ from: r.equipment.siteId, to: r.sites.id, optional: false }),
    fuelEntries: r.many.fuelEntries(),
    theftAlerts: r.many.theftAlerts(),
  },

  alertThresholds: {
    updater: r.one.users({ from: r.alertThresholds.updatedBy, to: r.users.id }),
  },

  tanks: {
    site: r.one.sites({ from: r.tanks.siteId, to: r.sites.id, optional: false }),
    intakes: r.many.tankIntakes(),
    dips: r.many.tankDips(),
    periodBalances: r.many.tankPeriodBalances(),
    fuelEntries: r.many.fuelEntries(),
  },

  suppliers: {
    intakes: r.many.tankIntakes(),
  },

  tankIntakes: {
    tank: r.one.tanks({ from: r.tankIntakes.tankId, to: r.tanks.id, optional: false }),
    supplier: r.one.suppliers({ from: r.tankIntakes.supplierId, to: r.suppliers.id, optional: false }),
    receiver: r.one.users({ from: r.tankIntakes.receivedBy, to: r.users.id, optional: false }),
    voider: r.one.users({ from: r.tankIntakes.voidedBy, to: r.users.id, alias: "voidedIntakes" }),
  },

  tankDips: {
    tank: r.one.tanks({ from: r.tankDips.tankId, to: r.tanks.id, optional: false }),
    recorder: r.one.users({ from: r.tankDips.recordedBy, to: r.users.id, optional: false }),
  },

  reportingPeriods: {
    closer: r.one.users({ from: r.reportingPeriods.closedBy, to: r.users.id }),
    tankBalances: r.many.tankPeriodBalances(),
  },

  tankPeriodBalances: {
    period: r.one.reportingPeriods({
      from: r.tankPeriodBalances.periodId,
      to: r.reportingPeriods.id,
      optional: false,
    }),
    tank: r.one.tanks({ from: r.tankPeriodBalances.tankId, to: r.tanks.id, optional: false }),
  },

  fuelEntries: {
    equipment: r.one.equipment({ from: r.fuelEntries.equipmentId, to: r.equipment.id, optional: false }),
    tank: r.one.tanks({ from: r.fuelEntries.tankId, to: r.tanks.id, optional: false }),
    operator: r.one.operators({ from: r.fuelEntries.operatorId, to: r.operators.id, optional: false }),
    site: r.one.sites({ from: r.fuelEntries.siteId, to: r.sites.id, optional: false }),
    recorder: r.one.users({ from: r.fuelEntries.recordedBy, to: r.users.id, optional: false }),
    voider: r.one.users({ from: r.fuelEntries.voidedBy, to: r.users.id, alias: "voidedEntries" }),
    corrections: r.many.fuelEntryCorrections(),
    alerts: r.many.theftAlerts({
      from: r.fuelEntries.id.through(r.alertFuelEntries.fuelEntryId),
      to: r.theftAlerts.id.through(r.alertFuelEntries.alertId),
    }),
  },

  fuelEntryCorrections: {
    fuelEntry: r.one.fuelEntries({
      from: r.fuelEntryCorrections.fuelEntryId,
      to: r.fuelEntries.id,
      optional: false,
    }),
    requester: r.one.users({
      from: r.fuelEntryCorrections.requestedBy,
      to: r.users.id,
      alias: "requestedBy",
      optional: false,
    }),
    reviewer: r.one.users({
      from: r.fuelEntryCorrections.reviewedBy,
      to: r.users.id,
      alias: "reviewedBy",
    }),
  },

  theftAlerts: {
    equipment: r.one.equipment({ from: r.theftAlerts.equipmentId, to: r.equipment.id, optional: false }),
    site: r.one.sites({ from: r.theftAlerts.siteId, to: r.sites.id, optional: false }),
    resolver: r.one.users({ from: r.theftAlerts.resolvedBy, to: r.users.id }),
    fuelEntries: r.many.fuelEntries({
      from: r.theftAlerts.id.through(r.alertFuelEntries.alertId),
      to: r.fuelEntries.id.through(r.alertFuelEntries.fuelEntryId),
    }),
    reads: r.many.alertReads(),
  },

  alertFuelEntries: {
    alert: r.one.theftAlerts({ from: r.alertFuelEntries.alertId, to: r.theftAlerts.id, optional: false }),
    fuelEntry: r.one.fuelEntries({
      from: r.alertFuelEntries.fuelEntryId,
      to: r.fuelEntries.id,
      optional: false,
    }),
  },

  alertReads: {
    alert: r.one.theftAlerts({ from: r.alertReads.alertId, to: r.theftAlerts.id, optional: false }),
    user: r.one.users({ from: r.alertReads.userId, to: r.users.id, optional: false }),
  },

  auditLog: {
    actor: r.one.users({ from: r.auditLog.actorId, to: r.users.id }),
  },
}));
