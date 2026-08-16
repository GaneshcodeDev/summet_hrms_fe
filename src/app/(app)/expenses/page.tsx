"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Plane, Plus, X } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Tabs } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyRow, TBody, TableFootnote, Td, Th, THead, Table, Tr } from "@/components/ui/table";
import { useSiteFilter } from "@/lib/site-context";
import { useEmployees } from "@/lib/employee-context";
import { useAccessControl } from "@/lib/access-control-context";
import { useExpense } from "@/lib/expense-context";
import { useToast } from "@/lib/toast-context";
import type { TravelMode, TravelRequest, TravelType } from "@/lib/types";

const travelModes: TravelMode[] = ["Flight", "Train", "Bus", "Cab", "Self"];
const travelTypes: TravelType[] = ["Domestic", "International"];

function currency(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

export default function ExpensesPage() {
  const { currentUser, canFeature } = useAccessControl();
  const { getEmployeeByEmployeeId } = useEmployees();
  const toast = useToast();
  const router = useRouter();
  const {
    claimsFor,
    requestsFor,
    visibleTeamClaims,
    visibleTeamTravelRequests,
    canApproveClaims,
    canApproveTravel,
    canDecideTravel,
    createExpenseClaim,
    createTravelRequest,
    decideTravelRequest,
  } = useExpense();

  const [active, setActive] = useState("claims");
  const [claimModalOpen, setClaimModalOpen] = useState(false);
  const [travelModalOpen, setTravelModalOpen] = useState(false);
  const [rejectTravelTarget, setRejectTravelTarget] = useState<TravelRequest | null>(null);

  const myClaims = claimsFor(currentUser.employeeId);
  const myTravelRequests = requestsFor(currentUser.employeeId);
  const teamClaims = useSiteFilter(useMemo(() => visibleTeamClaims(), [visibleTeamClaims]));
  const teamTravel = useSiteFilter(useMemo(() => visibleTeamTravelRequests(), [visibleTeamTravelRequests]));
  const approvalsCount = teamClaims.length + teamTravel.length;
  const canRequestTravel = canFeature("expenses.travel", "create") || canFeature("expenses.travel", "edit") || canFeature("expenses.travel", "manage");
  const canCreateClaim = canFeature("expenses.claims", "create") || canFeature("expenses.claims", "edit") || canFeature("expenses.claims", "manage");

  const tabs = [
    { id: "claims", label: "My Claims" },
    { id: "travel", label: "Travel Requests" },
    ...(canApproveClaims || canApproveTravel ? [{ id: "approvals", label: approvalsCount > 0 ? `Approvals (${approvalsCount})` : "Approvals" }] : []),
  ];

  function handleCreateClaim(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const result = createExpenseClaim(String(form.get("title") ?? ""), String(form.get("travelRequestId") ?? "") || undefined);
    (result.ok ? toast.success : toast.error)(result.message);
    if (result.ok && result.claim) {
      setClaimModalOpen(false);
      router.push(`/expenses/claims/${result.claim.id}`);
    }
  }

  function handleCreateTravel(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const advanceRequired = form.get("advanceRequired") === "on";
    const result = createTravelRequest({
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
    if (result.ok) {
      setTravelModalOpen(false);
      e.currentTarget.reset();
    }
  }

  function handleApproveTravel(request: TravelRequest) {
    const result = decideTravelRequest(request.id, "Approved");
    (result.ok ? toast.success : toast.error)(result.message);
  }

  function handleRejectTravelSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!rejectTravelTarget) return;
    const form = new FormData(e.currentTarget);
    const result = decideTravelRequest(rejectTravelTarget.id, "Rejected", String(form.get("reason") ?? ""));
    (result.ok ? toast.success : toast.error)(result.message);
    if (result.ok) setRejectTravelTarget(null);
  }

  const employeeName = (employeeId: string, fallback: string) => getEmployeeByEmployeeId(employeeId)?.name ?? fallback;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expenses & Travel"
        description="Submit expense claims and travel requests, and track reimbursements"
        action={
          active === "travel" && canRequestTravel ? (
            <Button onClick={() => setTravelModalOpen(true)}>
              <Plane className="h-4 w-4" /> Request Travel
            </Button>
          ) : active === "claims" && canCreateClaim ? (
            <Button onClick={() => setClaimModalOpen(true)}>
              <Plus className="h-4 w-4" /> New Claim
            </Button>
          ) : undefined
        }
      />

      <Tabs tabs={tabs} active={active} onChange={setActive} />

      {active === "claims" && (
        <Card>
          <Table>
            <THead>
              <Th>Title</Th>
              <Th>Items</Th>
              <Th>Total</Th>
              <Th>Status</Th>
            </THead>
            <TBody>
              {myClaims.map((c) => (
                <Tr key={c.id} hoverable>
                  <Td>
                    <Link href={`/expenses/claims/${c.id}`} className="font-medium text-slate-800 hover:text-indigo-600 dark:text-slate-100 dark:hover:text-indigo-400">
                      {c.title}
                    </Link>
                    <p className="text-xs text-slate-400 dark:text-slate-500">{c.id}</p>
                  </Td>
                  <Td>{c.items.length}</Td>
                  <Td>{currency(c.totalAmount)}</Td>
                  <Td>
                    <StatusBadge status={c.status} />
                  </Td>
                </Tr>
              ))}
              {myClaims.length === 0 && <EmptyRow colSpan={4}>No expense claims yet.</EmptyRow>}
            </TBody>
          </Table>
          <TableFootnote>
            Showing 1 to {myClaims.length} of {myClaims.length} entries
          </TableFootnote>
        </Card>
      )}

      {active === "travel" && (
        <Card>
          <Table>
            <THead>
              <Th>Purpose</Th>
              <Th>Type</Th>
              <Th>Destination</Th>
              <Th>Mode</Th>
              <Th>Dates</Th>
              <Th>Est. Cost</Th>
              <Th>Status</Th>
            </THead>
            <TBody>
              {myTravelRequests.map((r) => (
                <Tr key={r.id}>
                  <Td>
                    <Link href={`/expenses/travel/${r.id}`} className="font-medium text-slate-800 hover:text-indigo-600 dark:text-slate-100 dark:hover:text-indigo-400">
                      {r.purpose}
                    </Link>
                    <p className="text-xs text-slate-400 dark:text-slate-500">{r.id}</p>
                  </Td>
                  <Td>{r.travelType}</Td>
                  <Td>{r.destination}</Td>
                  <Td>{r.mode}</Td>
                  <Td>
                    {r.fromDate} → {r.toDate}
                  </Td>
                  <Td>{currency(r.estimatedCost)}</Td>
                  <Td>
                    <StatusBadge status={r.status} />
                  </Td>
                </Tr>
              ))}
              {myTravelRequests.length === 0 && <EmptyRow colSpan={7}>No travel requests yet.</EmptyRow>}
            </TBody>
          </Table>
          <TableFootnote>
            Showing 1 to {myTravelRequests.length} of {myTravelRequests.length} entries
          </TableFootnote>
        </Card>
      )}

      {active === "approvals" && (
        <div className="space-y-6">
          {canApproveClaims && (
            <Card>
              <div className="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-700 dark:border-slate-800 dark:text-slate-200">
                Expense Claims Awaiting Decision
              </div>
              <Table>
                <THead>
                  <Th>Employee</Th>
                  <Th>Title</Th>
                  <Th>Total</Th>
                  <Th>Status</Th>
                  <Th />
                </THead>
                <TBody>
                  {teamClaims.map((c) => (
                    <Tr key={c.id}>
                      <Td className="font-medium text-slate-800 dark:text-slate-100">{employeeName(c.employeeId, c.employee)}</Td>
                      <Td>{c.title}</Td>
                      <Td>{currency(c.totalAmount)}</Td>
                      <Td>
                        <StatusBadge status={c.status} />
                      </Td>
                      <Td>
                        <Link href={`/expenses/claims/${c.id}`} className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                          Review
                        </Link>
                      </Td>
                    </Tr>
                  ))}
                  {teamClaims.length === 0 && <EmptyRow colSpan={5}>Nothing waiting on you right now.</EmptyRow>}
                </TBody>
              </Table>
            </Card>
          )}

          {canApproveTravel && (
            <Card>
              <div className="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-700 dark:border-slate-800 dark:text-slate-200">
                Travel Requests Awaiting Decision
              </div>
              <Table>
                <THead>
                  <Th>Employee</Th>
                  <Th>Purpose</Th>
                  <Th>Destination</Th>
                  <Th>Est. Cost</Th>
                  <Th>Actions</Th>
                </THead>
                <TBody>
                  {teamTravel.map((r) => (
                    <Tr key={r.id}>
                      <Td className="font-medium text-slate-800 dark:text-slate-100">{employeeName(r.employeeId, r.employee)}</Td>
                      <Td>
                        <Link href={`/expenses/travel/${r.id}`} className="hover:text-indigo-600 dark:hover:text-indigo-400">
                          {r.purpose}
                        </Link>
                      </Td>
                      <Td>{r.destination}</Td>
                      <Td>{currency(r.estimatedCost)}</Td>
                      <Td>
                        {r.status === "Pending" && canDecideTravel(r) ? (
                          <div className="flex items-center gap-2">
                            <button onClick={() => handleApproveTravel(r)} className="flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400">
                              <Check className="h-3.5 w-3.5" /> Approve
                            </button>
                            <button onClick={() => setRejectTravelTarget(r)} className="flex items-center gap-1 rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-400">
                              <X className="h-3.5 w-3.5" /> Reject
                            </button>
                          </div>
                        ) : (
                          <StatusBadge status={r.status} />
                        )}
                      </Td>
                    </Tr>
                  ))}
                  {teamTravel.length === 0 && <EmptyRow colSpan={5}>Nothing waiting on you right now.</EmptyRow>}
                </TBody>
              </Table>
            </Card>
          )}
        </div>
      )}

      <Modal open={claimModalOpen} onClose={() => setClaimModalOpen(false)} title="New Expense Claim">
        <form className="space-y-4" onSubmit={handleCreateClaim}>
          <Field label="Title">
            <Input name="title" required placeholder="e.g. Bangalore Client Visit" />
          </Field>
          {myTravelRequests.some((r) => r.status === "Approved" || r.status === "Completed") && (
            <Field label="Travel Request (optional)">
              <Select name="travelRequestId" defaultValue="">
                <option value="">— Not related to a trip —</option>
                {myTravelRequests
                  .filter((r) => r.status === "Approved" || r.status === "Completed")
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.purpose} ({r.id})
                    </option>
                  ))}
              </Select>
            </Field>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setClaimModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Create Draft</Button>
          </div>
        </form>
      </Modal>

      <Modal open={travelModalOpen} onClose={() => setTravelModalOpen(false)} title="Request Travel">
        <form className="space-y-4" onSubmit={handleCreateTravel}>
          <Field label="Purpose">
            <Input name="purpose" required placeholder="e.g. Client demo" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Travel Type">
              <Select name="travelType" required defaultValue={travelTypes[0]}>
                {travelTypes.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </Select>
            </Field>
            <Field label="Mode">
              <Select name="mode" required defaultValue={travelModes[0]}>
                {travelModes.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="From">
              <Input name="from" required placeholder="e.g. Noida" />
            </Field>
            <Field label="To">
              <Input name="destination" required placeholder="e.g. Bangalore" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Start Date">
              <Input name="fromDate" type="date" required />
            </Field>
            <Field label="End Date">
              <Input name="toDate" type="date" required />
            </Field>
          </div>
          <Field label="Estimated Cost">
            <Input name="estimatedCost" type="number" min={1} required />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <input type="checkbox" name="advanceRequired" className="h-4 w-4 rounded border-slate-300" />
              Advance required
            </label>
            <Field label="Advance Amount">
              <Input name="advanceAmount" type="number" min={0} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <input type="checkbox" name="accommodationRequired" className="h-4 w-4 rounded border-slate-300" />
              Accommodation required
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <input type="checkbox" name="transportRequired" className="h-4 w-4 rounded border-slate-300" />
              Transport required
            </label>
          </div>
          <Field label="Remarks (optional)">
            <Textarea name="remarks" rows={2} />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setTravelModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Submit Request</Button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(rejectTravelTarget)} onClose={() => setRejectTravelTarget(null)} title="Reject Travel Request">
        {rejectTravelTarget && (
          <form className="space-y-4" onSubmit={handleRejectTravelSubmit}>
            <Field label="Reason">
              <Textarea name="reason" rows={3} required placeholder="e.g. Budget already allocated this quarter" />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setRejectTravelTarget(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="danger">
                Reject
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
