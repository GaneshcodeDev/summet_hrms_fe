"use client";

import { use, useState, type FormEvent } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyRow, TBody, Td, Th, THead, Table, Tr } from "@/components/ui/table";
import { useSite } from "@/lib/site-context";
import { useEmployees } from "@/lib/employee-context";
import { useMasters } from "@/lib/master-context";
import { useAssets } from "@/lib/asset-context";
import { useToast } from "@/lib/toast-context";
import type { AssetCondition } from "@/lib/types";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function formatDate(d?: string) {
  if (!d) return "—";
  return new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function inr(n?: number) {
  return n !== undefined ? `₹${n.toLocaleString("en-IN")}` : "Not recorded";
}

export default function AssetDetailPage(props: PageProps<"/assets/[assetId]">) {
  const { assetId } = use(props.params);
  const { mappedSites, isSuperAdmin, sites } = useSite();
  const { employees, getEmployeeByEmployeeId } = useEmployees();
  const { recordsOfType } = useMasters();
  const {
    assetById,
    canManageAssets,
    currentAssignmentFor,
    assignmentHistoryFor,
    assignAsset,
    returnAsset,
    transferAsset,
    maintenanceForAsset,
    startMaintenance,
    completeMaintenance,
    markDamaged,
    disposalFor,
    retireAsset,
    disposeAsset,
    auditFor,
  } = useAssets();
  const toast = useToast();

  const asset = assetById(assetId);
  if (!asset) notFound();
  if (!isSuperAdmin && !mappedSites.some((s) => s.id === asset.siteId)) notFound();

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "history", label: "Assignment History" },
    { id: "maintenance", label: "Maintenance" },
    { id: "audit", label: "Audit Trail" },
  ];
  const [active, setActive] = useState("overview");
  const [assignOpen, setAssignOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);
  const [completeMaintenanceId, setCompleteMaintenanceId] = useState<string | null>(null);
  const [disposeOpen, setDisposeOpen] = useState(false);

  const current = currentAssignmentFor(assetId);
  const history = assignmentHistoryFor(assetId);
  const maintenance = maintenanceForAsset(assetId);
  const activeMaintenance = maintenance.find((m) => m.status === "In Progress");
  const disposal = disposalFor(assetId);
  const audit = auditFor(assetId);
  const assetType = recordsOfType("AssetType").find((t) => t.id === asset.assetTypeId);
  const siteEmployees = employees.filter((e) => e.siteId === asset.siteId && e.employeeId !== current?.employeeId);

  function act(fn: () => { ok: boolean; message: string }, onOk?: () => void) {
    const result = fn();
    (result.ok ? toast.success : toast.error)(result.message);
    if (result.ok) onOk?.();
  }

  function handleAssign(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    act(
      () =>
        assignAsset(assetId, String(form.get("employeeId") ?? ""), {
          conditionAtAssignment: String(form.get("condition") ?? asset!.condition) as AssetCondition,
          remarks: String(form.get("remarks") ?? "") || undefined,
        }),
      () => setAssignOpen(false),
    );
  }

  function handleReturn(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!current) return;
    const form = new FormData(e.currentTarget);
    act(
      () =>
        returnAsset(current.id, {
          conditionAtReturn: String(form.get("condition") ?? "Good") as AssetCondition,
          remarks: String(form.get("remarks") ?? "") || undefined,
          damageNotes: String(form.get("damageNotes") ?? "") || undefined,
        }),
      () => setReturnOpen(false),
    );
  }

  function handleTransfer(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    act(
      () =>
        transferAsset(assetId, String(form.get("employeeId") ?? ""), {
          reason: String(form.get("reason") ?? ""),
          conditionAtTransfer: (String(form.get("condition") ?? "") || undefined) as AssetCondition | undefined,
        }),
      () => setTransferOpen(false),
    );
  }

  function handleStartMaintenance(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    act(
      () =>
        startMaintenance(assetId, {
          issue: String(form.get("issue") ?? ""),
          reportedDate: String(form.get("reportedDate") ?? "") || undefined,
          vendor: String(form.get("vendor") ?? "") || undefined,
          remarks: String(form.get("remarks") ?? "") || undefined,
        }),
      () => setMaintenanceOpen(false),
    );
  }

  function handleCompleteMaintenance(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!completeMaintenanceId) return;
    const form = new FormData(e.currentTarget);
    act(
      () =>
        completeMaintenance(completeMaintenanceId, {
          cost: form.get("cost") ? Number(form.get("cost")) : undefined,
          remarks: String(form.get("remarks") ?? "") || undefined,
        }),
      () => setCompleteMaintenanceId(null),
    );
  }

  function handleDispose(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    act(
      () =>
        disposeAsset(assetId, {
          reason: String(form.get("reason") ?? ""),
          remarks: String(form.get("remarks") ?? "") || undefined,
        }),
      () => setDisposeOpen(false),
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/assets" className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Assets
        </Link>
        <PageHeader
          title={asset.name}
          description={`${asset.assetCode} · ${assetType?.name ?? "—"} · ${sites.find((s) => s.id === asset.siteId)?.name ?? "—"}`}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={asset.condition} />
              <StatusBadge status={asset.status} />
              {canManageAssets && (
                <>
                  {asset.status === "Available" && <Button size="sm" onClick={() => setAssignOpen(true)}>Assign</Button>}
                  {asset.status === "Assigned" && (
                    <>
                      <Button size="sm" onClick={() => setReturnOpen(true)}>Return</Button>
                      <Button size="sm" variant="outline" onClick={() => setTransferOpen(true)}>Transfer</Button>
                    </>
                  )}
                  {asset.status !== "Retired" && asset.status !== "Disposed" && asset.status !== "Under Maintenance" && (
                    <Button size="sm" variant="outline" onClick={() => setMaintenanceOpen(true)}>Send for Maintenance</Button>
                  )}
                  {asset.status !== "Retired" && asset.status !== "Disposed" && (
                    <Button size="sm" variant="outline" onClick={() => act(() => markDamaged(assetId))}>Mark Damaged</Button>
                  )}
                  {asset.status !== "Assigned" && asset.status !== "Retired" && asset.status !== "Disposed" && (
                    <Button size="sm" variant="outline" onClick={() => act(() => retireAsset(assetId))}>Retire</Button>
                  )}
                  {asset.status === "Retired" && <Button size="sm" onClick={() => setDisposeOpen(true)}>Dispose</Button>}
                </>
              )}
            </div>
          }
        />
      </div>

      <Tabs tabs={tabs} active={active} onChange={setActive} />

      {active === "overview" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Asset Details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-y-3 pt-0 text-sm">
              <dt className="text-slate-400 dark:text-slate-500">Brand</dt>
              <dd className="text-slate-700 dark:text-slate-200">{asset.brand ?? "—"}</dd>
              <dt className="text-slate-400 dark:text-slate-500">Model</dt>
              <dd className="text-slate-700 dark:text-slate-200">{asset.model ?? "—"}</dd>
              <dt className="text-slate-400 dark:text-slate-500">Serial Number</dt>
              <dd className="text-slate-700 dark:text-slate-200">{asset.serialNumber ?? "—"}</dd>
              <dt className="text-slate-400 dark:text-slate-500">Purchase Date</dt>
              <dd className="text-slate-700 dark:text-slate-200">{formatDate(asset.purchaseDate)}</dd>
              <dt className="text-slate-400 dark:text-slate-500">Purchase Cost</dt>
              <dd className="text-slate-700 dark:text-slate-200">{inr(asset.purchaseCost)}</dd>
              <dt className="text-slate-400 dark:text-slate-500">Warranty Expiry</dt>
              <dd className="text-slate-700 dark:text-slate-200">{formatDate(asset.warrantyExpiry)}</dd>
              <dt className="text-slate-400 dark:text-slate-500">Vendor</dt>
              <dd className="text-slate-700 dark:text-slate-200">{asset.vendor ?? "—"}</dd>
              <dt className="text-slate-400 dark:text-slate-500">Location</dt>
              <dd className="text-slate-700 dark:text-slate-200">{asset.location ?? "—"}</dd>
              {asset.remarks && (
                <>
                  <dt className="text-slate-400 dark:text-slate-500">Remarks</dt>
                  <dd className="text-slate-700 dark:text-slate-200">{asset.remarks}</dd>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Current Assignment</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {current ? (
                <div className="space-y-2 text-sm">
                  <p className="font-medium text-slate-800 dark:text-slate-100">{getEmployeeByEmployeeId(current.employeeId)?.name ?? current.employeeId}</p>
                  <p className="text-slate-500 dark:text-slate-400">Assigned {formatDate(current.assignedDate)} by {current.assignedBy}</p>
                  <p className="text-slate-500 dark:text-slate-400">Condition at assignment: {current.conditionAtAssignment}</p>
                  {current.remarks && <p className="text-slate-500 dark:text-slate-400">{current.remarks}</p>}
                </div>
              ) : (
                <p className="text-sm text-slate-400 dark:text-slate-500">Not currently assigned.</p>
              )}
              {activeMaintenance && (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-500/10">
                  <p className="font-medium text-slate-700 dark:text-slate-200">In Maintenance: {activeMaintenance.issue}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Reported {formatDate(activeMaintenance.reportedDate)}</p>
                  {canManageAssets && (
                    <Button size="sm" className="mt-2" onClick={() => setCompleteMaintenanceId(activeMaintenance.id)}>
                      Complete Maintenance
                    </Button>
                  )}
                </div>
              )}
              {disposal && (
                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-800/60">
                  <p className="font-medium text-slate-700 dark:text-slate-200">Disposed {formatDate(disposal.disposalDate)}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{disposal.reason} — approved by {disposal.approvedBy}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {active === "history" && (
        <Card>
          <Table>
            <THead>
              <Th>Employee</Th>
              <Th>Assigned</Th>
              <Th>Returned</Th>
              <Th>Condition (Assign → Return)</Th>
              <Th>Notes</Th>
            </THead>
            <TBody>
              {history
                .slice()
                .reverse()
                .map((h) => (
                  <Tr key={h.id}>
                    <Td className="font-medium text-slate-800 dark:text-slate-100">{getEmployeeByEmployeeId(h.employeeId)?.name ?? h.employeeId}</Td>
                    <Td>{formatDate(h.assignedDate)}</Td>
                    <Td>{h.returnedDate ? formatDate(h.returnedDate) : "Active"}</Td>
                    <Td>
                      {h.conditionAtAssignment}
                      {h.conditionAtReturn ? ` → ${h.conditionAtReturn}` : ""}
                    </Td>
                    <Td>{h.transferredToEmployeeId ? `Transferred to ${getEmployeeByEmployeeId(h.transferredToEmployeeId)?.name ?? h.transferredToEmployeeId}` : h.returnRemarks ?? h.remarks ?? "—"}</Td>
                  </Tr>
                ))}
              {history.length === 0 && <EmptyRow colSpan={5}>No assignment history yet.</EmptyRow>}
            </TBody>
          </Table>
        </Card>
      )}

      {active === "maintenance" && (
        <Card>
          <Table>
            <THead>
              <Th>Issue</Th>
              <Th>Reported</Th>
              <Th>Start</Th>
              <Th>End</Th>
              <Th>Cost</Th>
              <Th>Vendor</Th>
              <Th>Status</Th>
            </THead>
            <TBody>
              {maintenance.map((m) => (
                <Tr key={m.id}>
                  <Td className="font-medium text-slate-800 dark:text-slate-100">{m.issue}</Td>
                  <Td>{formatDate(m.reportedDate)}</Td>
                  <Td>{formatDate(m.maintenanceStart)}</Td>
                  <Td>{formatDate(m.maintenanceEnd)}</Td>
                  <Td>{inr(m.cost)}</Td>
                  <Td>{m.vendor ?? "—"}</Td>
                  <Td>
                    <StatusBadge status={m.status} />
                  </Td>
                </Tr>
              ))}
              {maintenance.length === 0 && <EmptyRow colSpan={7}>No maintenance recorded.</EmptyRow>}
            </TBody>
          </Table>
        </Card>
      )}

      {active === "audit" && (
        <Card>
          <CardContent className="space-y-3 pt-5">
            {audit.map((e) => (
              <div key={e.id} className="border-b border-slate-100 pb-3 text-sm last:border-0 dark:border-slate-800">
                <p className="text-slate-700 dark:text-slate-200">
                  <span className="font-medium capitalize">{e.action.replace(/_/g, " ")}</span> — {e.detail}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  {e.actorName} · {new Date(e.timestamp).toLocaleString("en-IN")}
                </p>
              </div>
            ))}
            {audit.length === 0 && <p className="text-sm text-slate-400 dark:text-slate-500">No audit events yet.</p>}
          </CardContent>
        </Card>
      )}

      <Modal open={assignOpen} onClose={() => setAssignOpen(false)} title={`Assign ${asset.name}`}>
        <form className="space-y-4" onSubmit={handleAssign}>
          <Field label="Employee">
            <Select name="employeeId" required defaultValue="">
              <option value="" disabled>
                Select employee
              </option>
              {siteEmployees.map((e) => (
                <option key={e.employeeId} value={e.employeeId}>
                  {e.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Condition at Assignment">
            <Select name="condition" required defaultValue={asset.condition}>
              <option value="New">New</option>
              <option value="Good">Good</option>
              <option value="Fair">Fair</option>
              <option value="Damaged">Damaged</option>
            </Select>
          </Field>
          <Field label="Remarks (optional)">
            <Textarea name="remarks" rows={2} />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setAssignOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Assign</Button>
          </div>
        </form>
      </Modal>

      <Modal open={returnOpen} onClose={() => setReturnOpen(false)} title={`Return ${asset.name}`}>
        <form className="space-y-4" onSubmit={handleReturn}>
          <Field label="Condition at Return">
            <Select name="condition" required defaultValue="Good">
              <option value="New">New</option>
              <option value="Good">Good</option>
              <option value="Fair">Fair</option>
              <option value="Damaged">Damaged</option>
            </Select>
          </Field>
          <Field label="Remarks (optional)">
            <Textarea name="remarks" rows={2} />
          </Field>
          <Field label="Damage Notes (optional)">
            <Textarea name="damageNotes" rows={2} />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setReturnOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Confirm Return</Button>
          </div>
        </form>
      </Modal>

      <Modal open={transferOpen} onClose={() => setTransferOpen(false)} title={`Transfer ${asset.name}`}>
        <form className="space-y-4" onSubmit={handleTransfer}>
          <Field label="New Employee">
            <Select name="employeeId" required defaultValue="">
              <option value="" disabled>
                Select employee
              </option>
              {siteEmployees.map((e) => (
                <option key={e.employeeId} value={e.employeeId}>
                  {e.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Condition at Transfer (optional)">
            <Select name="condition" defaultValue="">
              <option value="">— Unchanged —</option>
              <option value="New">New</option>
              <option value="Good">Good</option>
              <option value="Fair">Fair</option>
              <option value="Damaged">Damaged</option>
            </Select>
          </Field>
          <Field label="Reason">
            <Textarea name="reason" required rows={2} />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setTransferOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Transfer</Button>
          </div>
        </form>
      </Modal>

      <Modal open={maintenanceOpen} onClose={() => setMaintenanceOpen(false)} title="Send for Maintenance">
        <form className="space-y-4" onSubmit={handleStartMaintenance}>
          <Field label="Issue">
            <Textarea name="issue" required rows={2} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Reported Date">
              <Input name="reportedDate" type="date" defaultValue={todayStr()} />
            </Field>
            <Field label="Vendor (optional)">
              <Input name="vendor" />
            </Field>
          </div>
          <Field label="Remarks (optional)">
            <Textarea name="remarks" rows={2} />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setMaintenanceOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Start Maintenance</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!completeMaintenanceId} onClose={() => setCompleteMaintenanceId(null)} title="Complete Maintenance">
        <form className="space-y-4" onSubmit={handleCompleteMaintenance}>
          <Field label="Cost (optional, ₹)">
            <Input name="cost" type="number" min={0} placeholder="Leave blank if not recorded" />
          </Field>
          <Field label="Remarks (optional)">
            <Textarea name="remarks" rows={2} />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setCompleteMaintenanceId(null)}>
              Cancel
            </Button>
            <Button type="submit">Mark Completed</Button>
          </div>
        </form>
      </Modal>

      <Modal open={disposeOpen} onClose={() => setDisposeOpen(false)} title={`Dispose ${asset.name}`}>
        <form className="space-y-4" onSubmit={handleDispose}>
          <Field label="Reason">
            <Textarea name="reason" required rows={2} />
          </Field>
          <Field label="Remarks (optional)">
            <Textarea name="remarks" rows={2} />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDisposeOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Confirm Disposal</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
