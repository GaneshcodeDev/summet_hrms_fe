"use client";

import { use, useState, type FormEvent } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, X } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { StatusBadge } from "@/components/ui/status-badge";
import { TBody, Td, Th, THead, Table, Tr } from "@/components/ui/table";
import { useSite } from "@/lib/site-context";
import { useEmployees } from "@/lib/employee-context";
import { useAccessControl } from "@/lib/access-control-context";
import { useExpense } from "@/lib/expense-context";
import { useApprovals } from "@/lib/approval-context";
import { useToast } from "@/lib/toast-context";
import type { TravelMode, TravelType } from "@/lib/types";

const travelModes: TravelMode[] = ["Flight", "Train", "Bus", "Cab", "Self"];
const travelTypes: TravelType[] = ["Domestic", "International"];

function currency(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}
function formatDate(d?: string) {
  if (!d) return "—";
  return new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function TravelRequestDetailPage(props: PageProps<"/expenses/travel/[requestId]">) {
  const { requestId } = use(props.params);
  const { mappedSites, isSuperAdmin, sites } = useSite();
  const { getEmployeeByEmployeeId } = useEmployees();
  const { currentUser } = useAccessControl();
  const toast = useToast();
  const {
    travelRequests,
    expenseClaims,
    canDecideTravel,
    canEditTravel,
    editTravelRequest,
    decideTravelRequest,
    cancelTravelRequest,
    travelSettlementFor,
  } = useExpense();
  const { instanceFor } = useApprovals();

  const request = travelRequests.find((r) => r.id === requestId);
  if (!request) notFound();
  if (!isSuperAdmin && !mappedSites.some((s) => s.id === request.siteId)) notFound();

  const [rejectOpen, setRejectOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const employee = getEmployeeByEmployeeId(request.employeeId);
  const settlement = travelSettlementFor(request.id);
  const instance = instanceFor("Expense", request.id);
  const decidable = canDecideTravel(request) && request.status === "Pending";
  const editable = canEditTravel(request);
  const isOwn = request.employeeId === currentUser.employeeId;

  function handleApprove() {
    const result = decideTravelRequest(request!.id, "Approved");
    (result.ok ? toast.success : toast.error)(result.message);
  }
  function handleRejectSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const result = decideTravelRequest(request!.id, "Rejected", String(form.get("reason") ?? ""));
    (result.ok ? toast.success : toast.error)(result.message);
    if (result.ok) setRejectOpen(false);
  }
  function handleCancel() {
    const result = cancelTravelRequest(request!.id);
    (result.ok ? toast.success : toast.error)(result.message);
  }
  function handleEditSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const advanceRequired = form.get("advanceRequired") === "on";
    const result = editTravelRequest(request!.id, {
      purpose: String(form.get("purpose") ?? ""),
      travelType: String(form.get("travelType")) as TravelType,
      from: String(form.get("from") ?? ""),
      destination: String(form.get("destination") ?? ""),
      mode: String(form.get("mode")) as TravelMode,
      fromDate: String(form.get("fromDate") ?? ""),
      toDate: String(form.get("toDate") ?? ""),
      estimatedCost: Number(form.get("estimatedCost") ?? 0),
      advanceRequired,
      advanceAmount: advanceRequired ? Number(form.get("advanceAmount") ?? 0) : undefined,
      accommodationRequired: form.get("accommodationRequired") === "on",
      transportRequired: form.get("transportRequired") === "on",
      remarks: String(form.get("remarks") ?? "") || undefined,
    });
    (result.ok ? toast.success : toast.error)(result.message);
    if (result.ok) setEditOpen(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/expenses" className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Expenses
        </Link>
        <PageHeader
          title={request.purpose}
          description={`${request.id} · ${employee?.name ?? request.employee} · ${sites.find((s) => s.id === request.siteId)?.name ?? "—"}`}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={request.status} />
              {editable && (
                <>
                  <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleCancel}>
                    Cancel Request
                  </Button>
                </>
              )}
              {decidable && (
                <>
                  <Button size="sm" onClick={handleApprove}>
                    <Check className="h-3.5 w-3.5" /> Approve
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setRejectOpen(true)}>
                    <X className="h-3.5 w-3.5" /> Reject
                  </Button>
                </>
              )}
            </div>
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Travel Details</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-y-3 pt-0 text-sm">
            <dt className="text-slate-400 dark:text-slate-500">Travel Type</dt>
            <dd className="text-slate-700 dark:text-slate-200">{request.travelType}</dd>
            <dt className="text-slate-400 dark:text-slate-500">From</dt>
            <dd className="text-slate-700 dark:text-slate-200">{request.from}</dd>
            <dt className="text-slate-400 dark:text-slate-500">To</dt>
            <dd className="text-slate-700 dark:text-slate-200">{request.destination}</dd>
            <dt className="text-slate-400 dark:text-slate-500">Mode</dt>
            <dd className="text-slate-700 dark:text-slate-200">{request.mode}</dd>
            <dt className="text-slate-400 dark:text-slate-500">Start Date</dt>
            <dd className="text-slate-700 dark:text-slate-200">{formatDate(request.fromDate)}</dd>
            <dt className="text-slate-400 dark:text-slate-500">End Date</dt>
            <dd className="text-slate-700 dark:text-slate-200">{formatDate(request.toDate)}</dd>
            <dt className="text-slate-400 dark:text-slate-500">Estimated Cost</dt>
            <dd className="text-slate-700 dark:text-slate-200">{currency(request.estimatedCost)}</dd>
            <dt className="text-slate-400 dark:text-slate-500">Advance</dt>
            <dd className="text-slate-700 dark:text-slate-200">{request.advanceRequired ? currency(request.advanceAmount ?? 0) : "Not required"}</dd>
            <dt className="text-slate-400 dark:text-slate-500">Accommodation</dt>
            <dd className="text-slate-700 dark:text-slate-200">{request.accommodationRequired ? "Required" : "Not required"}</dd>
            <dt className="text-slate-400 dark:text-slate-500">Transport</dt>
            <dd className="text-slate-700 dark:text-slate-200">{request.transportRequired ? "Required" : "Not required"}</dd>
            <dt className="text-slate-400 dark:text-slate-500">Requested Date</dt>
            <dd className="text-slate-700 dark:text-slate-200">{formatDate(request.appliedOn)}</dd>
            {request.remarks && (
              <>
                <dt className="text-slate-400 dark:text-slate-500">Remarks</dt>
                <dd className="text-slate-700 dark:text-slate-200">{request.remarks}</dd>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Approval</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0 text-sm">
            {request.approverName ? (
              <>
                <p className="text-slate-700 dark:text-slate-200">
                  {request.status} by {request.approverName} on {formatDate(request.decidedOn)}
                </p>
                {request.decisionReason && <p className="text-slate-500 dark:text-slate-400">{request.decisionReason}</p>}
              </>
            ) : (
              <p className="text-slate-400 dark:text-slate-500">{isOwn ? "Awaiting a decision." : "Not yet decided."}</p>
            )}

            {instance && instance.actions.length > 0 && (
              <div className="mt-4 space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Approval History</p>
                {instance.actions
                  .slice()
                  .reverse()
                  .map((a) => (
                    <div key={a.id} className="text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-medium text-slate-700 dark:text-slate-200">{a.approverType === "REPORTING_MANAGER" ? "Manager" : a.approverType}</span> — {a.action}
                      {a.comment ? ` (${a.comment})` : ""} · {new Date(a.timestamp).toLocaleString("en-IN")}
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        {settlement && (settlement.claims.length > 0 || request.status === "Approved" || request.status === "Completed") && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Travel Settlement</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                <div>
                  <p className="text-xs text-slate-400 dark:text-slate-500">Estimated</p>
                  <p className="text-lg font-semibold text-slate-800 dark:text-slate-100">{currency(settlement.estimated)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 dark:text-slate-500">Claimed</p>
                  <p className="text-lg font-semibold text-slate-800 dark:text-slate-100">{currency(settlement.claimed)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 dark:text-slate-500">Approved</p>
                  <p className="text-lg font-semibold text-slate-800 dark:text-slate-100">{currency(settlement.approved)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 dark:text-slate-500">Reimbursed</p>
                  <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">{currency(settlement.reimbursed)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 dark:text-slate-500">Outstanding</p>
                  <p className="text-lg font-semibold text-amber-600 dark:text-amber-400">{currency(settlement.outstanding)}</p>
                </div>
              </div>
              {settlement.claims.length > 0 ? (
                <Table className="mt-4">
                  <THead>
                    <Th>Claim</Th>
                    <Th>Total</Th>
                    <Th>Status</Th>
                  </THead>
                  <TBody>
                    {settlement.claims.map((c) => (
                      <Tr key={c.id}>
                        <Td>
                          <Link href={`/expenses/claims/${c.id}`} className="font-medium text-slate-800 hover:text-indigo-600 dark:text-slate-100 dark:hover:text-indigo-400">
                            {c.title}
                          </Link>
                        </Td>
                        <Td>{currency(c.totalAmount)}</Td>
                        <Td>
                          <StatusBadge status={c.status} />
                        </Td>
                      </Tr>
                    ))}
                  </TBody>
                </Table>
              ) : (
                <p className="mt-4 text-sm text-slate-400 dark:text-slate-500">No expense claims filed against this trip yet.</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <Modal open={rejectOpen} onClose={() => setRejectOpen(false)} title="Reject Travel Request">
        <form className="space-y-4" onSubmit={handleRejectSubmit}>
          <Field label="Reason">
            <Textarea name="reason" rows={3} required placeholder="e.g. Budget already allocated this quarter" />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger">
              Reject
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Travel Request">
        <form className="space-y-4" onSubmit={handleEditSubmit}>
          <Field label="Purpose">
            <Input name="purpose" required defaultValue={request.purpose} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Travel Type">
              <Select name="travelType" required defaultValue={request.travelType}>
                {travelTypes.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </Select>
            </Field>
            <Field label="Mode">
              <Select name="mode" required defaultValue={request.mode}>
                {travelModes.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="From">
              <Input name="from" required defaultValue={request.from} />
            </Field>
            <Field label="To">
              <Input name="destination" required defaultValue={request.destination} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Start Date">
              <Input name="fromDate" type="date" required defaultValue={request.fromDate} />
            </Field>
            <Field label="End Date">
              <Input name="toDate" type="date" required defaultValue={request.toDate} />
            </Field>
          </div>
          <Field label="Estimated Cost">
            <Input name="estimatedCost" type="number" min={1} required defaultValue={request.estimatedCost} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <input type="checkbox" name="advanceRequired" defaultChecked={request.advanceRequired} className="h-4 w-4 rounded border-slate-300" />
              Advance required
            </label>
            <Field label="Advance Amount">
              <Input name="advanceAmount" type="number" min={0} defaultValue={request.advanceAmount ?? ""} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <input type="checkbox" name="accommodationRequired" defaultChecked={request.accommodationRequired} className="h-4 w-4 rounded border-slate-300" />
              Accommodation required
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <input type="checkbox" name="transportRequired" defaultChecked={request.transportRequired} className="h-4 w-4 rounded border-slate-300" />
              Transport required
            </label>
          </div>
          <Field label="Remarks (optional)">
            <Textarea name="remarks" rows={2} defaultValue={request.remarks} />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Save Changes</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
