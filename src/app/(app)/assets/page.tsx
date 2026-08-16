"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Laptop, CheckCircle2, Wrench, AlertTriangle, Archive, Users2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatCard } from "@/components/ui/stat-card";
import { Tabs } from "@/components/ui/tabs";
import { EmptyRow, TBody, TableFootnote, Td, Th, THead, Table, Tr } from "@/components/ui/table";
import { useSite, useSiteFilter } from "@/lib/site-context";
import { useAccessControl } from "@/lib/access-control-context";
import { useEmployees } from "@/lib/employee-context";
import { useMasters } from "@/lib/master-context";
import { useAssets } from "@/lib/asset-context";
import { useToast } from "@/lib/toast-context";
import { getAssetInventorySummary } from "@/lib/asset-engine";
import type { AssetCondition } from "@/lib/types";

function formatDate(d?: string) {
  if (!d) return "—";
  return new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function AssetsPage() {
  const { sites, currentSiteId, currentSite, isAllSites } = useSite();
  const { currentUser, canFeature } = useAccessControl();
  const { employees } = useEmployees();
  const { recordsOfType } = useMasters();
  const {
    assets,
    canManageAssets,
    createAsset,
    assignmentsForEmployee,
    activeAssignmentsForEmployee,
    currentAssignmentFor,
    requestsFor,
    visibleRequests,
    canDecideRequests,
    decideAssetRequest,
    requestAsset,
  } = useAssets();

  const filteredAssets = useSiteFilter(assets);
  const scopedVisibleRequests = useSiteFilter(visibleRequests());

  const isManager = useMemo(() => employees.some((e) => e.reportingManagerId === currentUser.employeeId), [employees, currentUser.employeeId]);
  const teamMembers = useMemo(() => employees.filter((e) => e.reportingManagerId === currentUser.employeeId), [employees, currentUser.employeeId]);

  const myAssignments = activeAssignmentsForEmployee(currentUser.employeeId);
  const myRequests = requestsFor(currentUser.employeeId);
  const summary = useMemo(() => getAssetInventorySummary(filteredAssets), [filteredAssets]);
  const pendingRequestsForScope = scopedVisibleRequests.filter((r) => r.status === "Pending");
  const teamAssetsCount = useMemo(() => teamMembers.reduce((sum, m) => sum + activeAssignmentsForEmployee(m.employeeId).length, 0), [teamMembers, activeAssignmentsForEmployee]);
  const canRequestAsset = canFeature("assets.requests", "create");

  const tabs = [
    { id: "inventory", label: "Inventory" },
    { id: "my-assets", label: "My Assets" },
    ...(canDecideRequests || isManager ? [{ id: "requests", label: "Requests" }] : []),
  ];
  const [active, setActive] = useState("inventory");
  const [modalOpen, setModalOpen] = useState(false);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const toast = useToast();

  function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const result = createAsset({
      siteId: String(form.get("siteId") ?? (isAllSites ? sites[0]?.id : currentSiteId)),
      assetTypeId: String(form.get("assetTypeId") ?? ""),
      name: String(form.get("name") ?? ""),
      brand: String(form.get("brand") ?? "") || undefined,
      model: String(form.get("model") ?? "") || undefined,
      serialNumber: String(form.get("serialNumber") ?? "") || undefined,
      purchaseDate: String(form.get("purchaseDate") ?? "") || undefined,
      purchaseCost: form.get("purchaseCost") ? Number(form.get("purchaseCost")) : undefined,
      warrantyExpiry: String(form.get("warrantyExpiry") ?? "") || undefined,
      vendor: String(form.get("vendor") ?? "") || undefined,
      location: String(form.get("location") ?? "") || undefined,
      condition: String(form.get("condition") ?? "New") as AssetCondition,
    });
    (result.ok ? toast.success : toast.error)(result.message);
    if (result.ok) {
      setModalOpen(false);
      e.currentTarget.reset();
    }
  }

  function handleRequest(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const result = requestAsset({
      employeeId: currentUser.employeeId,
      siteId: currentUser.siteId,
      assetTypeId: String(form.get("assetTypeId") ?? ""),
      reason: String(form.get("reason") ?? ""),
      requestedDate: new Date().toISOString().slice(0, 10),
    });
    (result.ok ? toast.success : toast.error)(result.message);
    if (result.ok) {
      setRequestModalOpen(false);
      e.currentTarget.reset();
    }
  }

  function handleDecide(id: string, decision: "Approved" | "Rejected") {
    let comment: string | undefined;
    if (decision === "Rejected") {
      comment = window.prompt("Reason for rejecting this request?") ?? "";
      if (!comment.trim()) return;
    }
    const result = decideAssetRequest(id, decision, comment);
    (result.ok ? toast.success : toast.error)(result.message);
  }

  const assetTypeName = (id: string) => recordsOfType("AssetType").find((t) => t.id === id)?.name ?? id;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assets"
        description={isAllSites ? "Company assets and allocations across all sites" : `Assets at ${currentSite?.name}`}
        action={
          <div className="flex gap-2">
            {canManageAssets && (
              <Button onClick={() => setModalOpen(true)}>
                <Plus className="h-4 w-4" /> Add Asset
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {canManageAssets ? (
          <>
            <StatCard label="Total Assets" value={String(summary.total)} icon={Laptop} tone="indigo" />
            <StatCard label="Available" value={String(summary.available)} icon={CheckCircle2} tone="emerald" />
            <StatCard label="Assigned" value={String(summary.assigned)} icon={Users2} tone="sky" />
            <StatCard label="Maintenance" value={String(summary.maintenance)} icon={Wrench} tone="amber" />
            <StatCard label="Damaged" value={String(summary.damaged)} icon={AlertTriangle} tone="rose" />
            <StatCard label="Retired" value={String(summary.retired)} icon={Archive} tone="indigo" />
            <StatCard label="Pending Requests" value={String(pendingRequestsForScope.length)} icon={AlertTriangle} tone="amber" />
          </>
        ) : isManager ? (
          <>
            <StatCard label="Team Assets" value={String(teamAssetsCount)} icon={Users2} tone="indigo" />
            <StatCard label="Pending Requests" value={String(pendingRequestsForScope.length)} icon={AlertTriangle} tone="amber" />
          </>
        ) : (
          <>
            <StatCard label="My Assets" value={String(myAssignments.length)} icon={Laptop} tone="indigo" />
            <StatCard label="Pending Asset Requests" value={String(myRequests.filter((r) => r.status === "Pending").length)} icon={AlertTriangle} tone="amber" />
          </>
        )}
      </div>

      <Tabs tabs={tabs} active={active} onChange={setActive} />

      {active === "inventory" && (
        <Card>
          <Table>
            <THead>
              <Th>Asset</Th>
              <Th>Type</Th>
              {isAllSites && <Th>Site</Th>}
              <Th>Serial Number</Th>
              <Th>Condition</Th>
              <Th>Status</Th>
            </THead>
            <TBody>
              {filteredAssets.map((a) => (
                <Tr key={a.id} hoverable>
                  <Td>
                    <Link href={`/assets/${a.id}`} className="font-medium text-slate-800 hover:text-indigo-600 dark:text-slate-100 dark:hover:text-indigo-400">
                      {a.name}
                    </Link>
                    <p className="text-xs text-slate-400 dark:text-slate-500">{a.assetCode}</p>
                  </Td>
                  <Td>{assetTypeName(a.assetTypeId)}</Td>
                  {isAllSites && <Td>{sites.find((s) => s.id === a.siteId)?.name ?? "—"}</Td>}
                  <Td>{a.serialNumber ?? "—"}</Td>
                  <Td>
                    <StatusBadge status={a.condition} />
                  </Td>
                  <Td>
                    <StatusBadge status={a.status} />
                  </Td>
                </Tr>
              ))}
              {filteredAssets.length === 0 && <EmptyRow colSpan={isAllSites ? 6 : 5}>No assets configured.</EmptyRow>}
            </TBody>
          </Table>
          <TableFootnote>
            Showing 1 to {filteredAssets.length} of {filteredAssets.length} entries
          </TableFootnote>
        </Card>
      )}

      {active === "my-assets" && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>My Assets</CardTitle>
              {canRequestAsset && (
                <Button size="sm" variant="outline" onClick={() => setRequestModalOpen(true)}>
                  <Plus className="h-3.5 w-3.5" /> Request Asset
                </Button>
              )}
            </CardHeader>
            <CardContent className="pt-0">
              <Table>
                <THead>
                  <Th>Asset</Th>
                  <Th>Type</Th>
                  <Th>Assigned Date</Th>
                  <Th>Condition</Th>
                </THead>
                <TBody>
                  {myAssignments.map((asn) => {
                    const asset = assets.find((a) => a.id === asn.assetId);
                    return (
                      <Tr key={asn.id}>
                        <Td className="font-medium text-slate-800 dark:text-slate-100">
                          {asset ? <Link href={`/assets/${asset.id}`} className="hover:text-indigo-600 dark:hover:text-indigo-400">{asset.name}</Link> : "—"}
                        </Td>
                        <Td>{asset ? assetTypeName(asset.assetTypeId) : "—"}</Td>
                        <Td>{asn.assignedDate}</Td>
                        <Td>
                          <StatusBadge status={asn.conditionAtAssignment} />
                        </Td>
                      </Tr>
                    );
                  })}
                  {myAssignments.length === 0 && <EmptyRow colSpan={4}>No assets assigned.</EmptyRow>}
                </TBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>My Requests</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <Table>
                <THead>
                  <Th>Asset Type</Th>
                  <Th>Reason</Th>
                  <Th>Requested Date</Th>
                  <Th>Status</Th>
                </THead>
                <TBody>
                  {myRequests.map((r) => (
                    <Tr key={r.id}>
                      <Td className="font-medium text-slate-800 dark:text-slate-100">{assetTypeName(r.assetTypeId)}</Td>
                      <Td>{r.reason}</Td>
                      <Td>{r.requestedDate}</Td>
                      <Td>
                        <StatusBadge status={r.status} />
                      </Td>
                    </Tr>
                  ))}
                  {myRequests.length === 0 && <EmptyRow colSpan={4}>No asset requests yet.</EmptyRow>}
                </TBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {active === "requests" && (canDecideRequests || isManager) && (
        <Card>
          <Table>
            <THead>
              <Th>Employee</Th>
              <Th>Asset Type</Th>
              <Th>Reason</Th>
              <Th>Requested Date</Th>
              <Th>Status</Th>
              <Th></Th>
            </THead>
            <TBody>
              {scopedVisibleRequests.map((r) => {
                const employee = employees.find((e) => e.employeeId === r.employeeId);
                return (
                  <Tr key={r.id}>
                    <Td className="font-medium text-slate-800 dark:text-slate-100">{employee?.name ?? r.employeeId}</Td>
                    <Td>{assetTypeName(r.assetTypeId)}</Td>
                    <Td>{r.reason}</Td>
                    <Td>{r.requestedDate}</Td>
                    <Td>
                      <StatusBadge status={r.status} />
                    </Td>
                    <Td>
                      {r.status === "Pending" && (
                        <div className="flex justify-end gap-2">
                          <Button size="sm" onClick={() => handleDecide(r.id, "Approved")}>
                            Approve
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleDecide(r.id, "Rejected")}>
                            Reject
                          </Button>
                        </div>
                      )}
                      {r.status === "Approved" && canManageAssets && (
                        <Link href="/assets" className="text-xs text-indigo-600 hover:underline dark:text-indigo-400">
                          Fulfil from Inventory tab
                        </Link>
                      )}
                    </Td>
                  </Tr>
                );
              })}
              {scopedVisibleRequests.length === 0 && <EmptyRow colSpan={6}>No asset requests to show.</EmptyRow>}
            </TBody>
          </Table>
        </Card>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Asset">
        <form className="space-y-4" onSubmit={handleCreate}>
          {isAllSites && (
            <Field label="Site">
              <Select name="siteId" required defaultValue={sites[0]?.id}>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Asset Name">
            <Input name="name" required placeholder='e.g. MacBook Pro 14"' />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Type">
              <Select name="assetTypeId" required defaultValue="">
                <option value="" disabled>
                  Select type
                </option>
                {recordsOfType("AssetType").map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Condition">
              <Select name="condition" required defaultValue="New">
                <option value="New">New</option>
                <option value="Good">Good</option>
                <option value="Fair">Fair</option>
                <option value="Damaged">Damaged</option>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Brand (optional)">
              <Input name="brand" />
            </Field>
            <Field label="Model (optional)">
              <Input name="model" />
            </Field>
          </div>
          <Field label="Serial Number (optional)">
            <Input name="serialNumber" placeholder="e.g. MBP14-2201" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Purchase Date (optional)">
              <Input name="purchaseDate" type="date" />
            </Field>
            <Field label="Purchase Cost (optional, ₹)">
              <Input name="purchaseCost" type="number" min={0} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Warranty Expiry (optional)">
              <Input name="warrantyExpiry" type="date" />
            </Field>
            <Field label="Vendor (optional)">
              <Input name="vendor" />
            </Field>
          </div>
          <Field label="Location (optional)">
            <Input name="location" placeholder="e.g. Noida — IT Storage Room" />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Add Asset</Button>
          </div>
        </form>
      </Modal>

      <Modal open={requestModalOpen} onClose={() => setRequestModalOpen(false)} title="Request Asset">
        <form className="space-y-4" onSubmit={handleRequest}>
          <Field label="Asset Type">
            <Select name="assetTypeId" required defaultValue="">
              <option value="" disabled>
                Select type
              </option>
              {recordsOfType("AssetType").map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Reason">
            <Textarea name="reason" required rows={3} placeholder="Why do you need this asset?" />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setRequestModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Submit Request</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
