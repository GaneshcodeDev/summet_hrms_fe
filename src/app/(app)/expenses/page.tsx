"use client";

import { FormEvent, useMemo, useState } from "react";
import { Check, Plane, Plus, Receipt, Trash2, X } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Tabs } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyRow, TBody, TableFootnote, Td, Th, THead, Table, Tr } from "@/components/ui/table";
import { expenseCategories, expenseCategoryConfig } from "@/lib/expense-data";
import { useExpense } from "@/lib/expense-context";
import { useAccessControl } from "@/lib/access-control-context";
import { useToast } from "@/lib/toast-context";
import type { ExpenseCategory, ExpenseClaim, TravelMode, TravelRequest } from "@/lib/types";

const travelModes: TravelMode[] = ["Flight", "Train", "Bus", "Cab", "Self"];

function currency(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

export default function ExpensesPage() {
  const { currentUser } = useAccessControl();
  const toast = useToast();
  const {
    claimsFor,
    requestsFor,
    visibleTeamClaims,
    visibleTeamTravelRequests,
    canApproveClaims,
    canApproveTravel,
    canManagerDecide,
    canFinanceDecide,
    canDecideTravel,
    createExpenseClaim,
    createTravelRequest,
    decideTravelRequest,
    managerDecideClaim,
    financeDecideClaim,
    markReimbursed,
    cancelClaim,
    hasBroadClaimScope,
  } = useExpense();

  const [active, setActive] = useState("claims");
  const [claimModalOpen, setClaimModalOpen] = useState(false);
  const [travelModalOpen, setTravelModalOpen] = useState(false);
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [rejectTravelTarget, setRejectTravelTarget] = useState<TravelRequest | null>(null);

  const myClaims = claimsFor(currentUser.employeeId);
  const myTravelRequests = requestsFor(currentUser.employeeId);
  const teamClaims = useMemo(() => visibleTeamClaims(), [visibleTeamClaims]);
  const teamTravel = useMemo(() => visibleTeamTravelRequests(), [visibleTeamTravelRequests]);
  const approvalsCount = teamClaims.length + teamTravel.length;

  const tabs = [
    { id: "claims", label: "My Claims" },
    { id: "travel", label: "Travel Requests" },
    ...(canApproveClaims || canApproveTravel ? [{ id: "approvals", label: approvalsCount > 0 ? `Approvals (${approvalsCount})` : "Approvals" }] : []),
  ];

  function handleCreateClaim(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const result = createExpenseClaim(String(form.get("title") ?? ""));
    (result.ok ? toast.success : toast.error)(result.message);
    if (result.ok) {
      setClaimModalOpen(false);
      e.currentTarget.reset();
    }
  }

  function handleCreateTravel(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const result = createTravelRequest({
      purpose: String(form.get("purpose") ?? ""),
      destination: String(form.get("destination") ?? ""),
      mode: String(form.get("mode")) as TravelMode,
      fromDate: String(form.get("fromDate") ?? ""),
      toDate: String(form.get("toDate") ?? ""),
      estimatedCost: Number(form.get("estimatedCost") ?? 0),
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

  const selectedClaim = [...myClaims, ...teamClaims].find((c) => c.id === selectedClaimId) ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expenses & Travel"
        description="Submit expense claims and travel requests, and track reimbursements"
        action={
          active === "travel" ? (
            <Button onClick={() => setTravelModalOpen(true)}>
              <Plane className="h-4 w-4" /> Request Travel
            </Button>
          ) : active === "claims" ? (
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
              <Th />
            </THead>
            <TBody>
              {myClaims.map((c) => (
                <Tr key={c.id} hoverable>
                  <Td className="font-medium text-slate-800 dark:text-slate-100">{c.title}</Td>
                  <Td>{c.items.length}</Td>
                  <Td>{currency(c.totalAmount)}</Td>
                  <Td>
                    <StatusBadge status={c.status} />
                  </Td>
                  <Td>
                    <button onClick={() => setSelectedClaimId(c.id)} className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                      View
                    </button>
                  </Td>
                </Tr>
              ))}
              {myClaims.length === 0 && <EmptyRow colSpan={5}>No expense claims yet.</EmptyRow>}
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
              <Th>Destination</Th>
              <Th>Mode</Th>
              <Th>Dates</Th>
              <Th>Est. Cost</Th>
              <Th>Status</Th>
            </THead>
            <TBody>
              {myTravelRequests.map((r) => (
                <Tr key={r.id}>
                  <Td className="font-medium text-slate-800 dark:text-slate-100">{r.purpose}</Td>
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
              {myTravelRequests.length === 0 && <EmptyRow colSpan={6}>No travel requests yet.</EmptyRow>}
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
                      <Td className="font-medium text-slate-800 dark:text-slate-100">{c.employee}</Td>
                      <Td>{c.title}</Td>
                      <Td>{currency(c.totalAmount)}</Td>
                      <Td>
                        <StatusBadge status={c.status} />
                      </Td>
                      <Td>
                        <button onClick={() => setSelectedClaimId(c.id)} className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                          Review
                        </button>
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
                      <Td className="font-medium text-slate-800 dark:text-slate-100">{r.employee}</Td>
                      <Td>{r.purpose}</Td>
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
            <Field label="Destination">
              <Input name="destination" required placeholder="e.g. Bangalore" />
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
              <Input name="fromDate" type="date" required />
            </Field>
            <Field label="To">
              <Input name="toDate" type="date" required />
            </Field>
          </div>
          <Field label="Estimated Cost">
            <Input name="estimatedCost" type="number" min={1} required />
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

      {selectedClaim && (
        <ClaimDetailModal
          claim={selectedClaim}
          onClose={() => setSelectedClaimId(null)}
          canManagerDecide={canManagerDecide(selectedClaim)}
          canFinanceDecide={canFinanceDecide(selectedClaim)}
          canReimburse={hasBroadClaimScope && selectedClaim.status === "Finance Approved"}
          onManagerDecide={managerDecideClaim}
          onFinanceDecide={financeDecideClaim}
          onReimburse={markReimbursed}
          onCancelClaim={cancelClaim}
        />
      )}
    </div>
  );
}

function ClaimDetailModal({
  claim,
  onClose,
  canManagerDecide,
  canFinanceDecide,
  canReimburse,
  onManagerDecide,
  onFinanceDecide,
  onReimburse,
  onCancelClaim,
}: {
  claim: ExpenseClaim;
  onClose: () => void;
  canManagerDecide: boolean;
  canFinanceDecide: boolean;
  canReimburse: boolean;
  onManagerDecide: (id: string, status: "Manager Approved" | "Rejected", reason?: string) => { ok: boolean; message: string };
  onFinanceDecide: (id: string, status: "Finance Approved" | "Rejected", reason?: string) => { ok: boolean; message: string };
  onReimburse: (id: string, reference: string) => { ok: boolean; message: string };
  onCancelClaim: (id: string) => { ok: boolean; message: string };
}) {
  const toast = useToast();
  const { currentUser } = useAccessControl();
  const { addExpenseItem, removeExpenseItem, submitClaim } = useExpense();
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState<"manager" | "finance" | null>(null);
  const [reimburseRef, setReimburseRef] = useState("");
  const [showReimburse, setShowReimburse] = useState(false);

  const isOwner = claim.employeeId === currentUser.employeeId;
  const isDraft = claim.status === "Draft";

  function handleAddItem(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const result = addExpenseItem(claim.id, {
      date: String(form.get("date") ?? ""),
      category: String(form.get("category")) as ExpenseCategory,
      amount: Number(form.get("amount") ?? 0),
      description: String(form.get("description") ?? ""),
      hasReceipt: form.get("hasReceipt") === "on",
      overLimitNote: String(form.get("overLimitNote") ?? "") || undefined,
    });
    (result.ok ? toast.success : toast.error)(result.message);
    if (result.ok) e.currentTarget.reset();
  }

  function handleRemoveItem(itemId: string) {
    const result = removeExpenseItem(claim.id, itemId);
    if (!result.ok) toast.error(result.message);
  }

  function handleSubmitClaim() {
    const result = submitClaim(claim.id);
    (result.ok ? toast.success : toast.error)(result.message);
    if (result.ok) onClose();
  }

  function handleCancel() {
    const result = onCancelClaim(claim.id);
    (result.ok ? toast.success : toast.error)(result.message);
    if (result.ok) onClose();
  }

  function handleManagerApprove() {
    const result = onManagerDecide(claim.id, "Manager Approved");
    (result.ok ? toast.success : toast.error)(result.message);
  }

  function handleFinanceApprove() {
    const result = onFinanceDecide(claim.id, "Finance Approved");
    (result.ok ? toast.success : toast.error)(result.message);
  }

  function handleRejectSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const result = showReject === "manager" ? onManagerDecide(claim.id, "Rejected", rejectReason) : onFinanceDecide(claim.id, "Rejected", rejectReason);
    (result.ok ? toast.success : toast.error)(result.message);
    if (result.ok) {
      setShowReject(null);
      setRejectReason("");
    }
  }

  function handleReimburseSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const result = onReimburse(claim.id, reimburseRef);
    (result.ok ? toast.success : toast.error)(result.message);
    if (result.ok) setShowReimburse(false);
  }

  return (
    <Modal open onClose={onClose} title={claim.title}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-500 dark:text-slate-400">{claim.employee}</span>
          <StatusBadge status={claim.status} />
        </div>

        <div className="space-y-2">
          {claim.items.map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 p-3 text-sm dark:border-slate-800">
              <div>
                <p className="font-medium text-slate-700 dark:text-slate-200">
                  {item.category} · {item.description}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  {item.date} · {item.hasReceipt ? "Receipt attached" : "No receipt"}
                </p>
                {item.overLimitNote && <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">Over limit — {item.overLimitNote}</p>}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-800 dark:text-slate-100">{currency(item.amount)}</span>
                {isDraft && isOwner && (
                  <button onClick={() => handleRemoveItem(item.id)} className="text-slate-400 hover:text-rose-500">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
          {claim.items.length === 0 && <p className="text-sm text-slate-400 dark:text-slate-500">No items added yet.</p>}
        </div>

        <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3.5 py-2.5 text-sm font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          <span>Total</span>
          <span>{currency(claim.totalAmount)}</span>
        </div>

        {isDraft && isOwner && (
          <form className="space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800" onSubmit={handleAddItem}>
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              <Receipt className="h-3.5 w-3.5" /> Add Item
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date">
                <Input name="date" type="date" required />
              </Field>
              <Field label="Category">
                <Select name="category" required defaultValue={expenseCategories[0]}>
                  {expenseCategories.map((c) => (
                    <option key={c} value={c}>
                      {c} (limit {currency(expenseCategoryConfig[c].claimLimit)})
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Description">
              <Input name="description" required placeholder="e.g. Taxi to airport" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount">
                <Input name="amount" type="number" min={1} required />
              </Field>
              <label className="flex items-center gap-2 pt-6 text-sm text-slate-600 dark:text-slate-300">
                <input type="checkbox" name="hasReceipt" className="h-4 w-4 rounded border-slate-300" />
                Receipt attached
              </label>
            </div>
            <Field label="Justification (only needed if over the category limit)">
              <Textarea name="overLimitNote" rows={2} placeholder="Explain why this exceeds the usual limit" />
            </Field>
            <Button type="submit" size="sm" variant="outline">
              <Plus className="h-3.5 w-3.5" /> Add Item
            </Button>
          </form>
        )}

        {isDraft && isOwner && (
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
            <Button variant="outline" onClick={handleCancel}>
              Discard Draft
            </Button>
            <Button onClick={handleSubmitClaim}>Submit for Approval</Button>
          </div>
        )}

        {claim.managerDecisionReason && (
          <p className="text-xs text-slate-400 dark:text-slate-500">Manager: {claim.managerDecisionReason}</p>
        )}
        {claim.financeDecisionReason && (
          <p className="text-xs text-slate-400 dark:text-slate-500">Finance: {claim.financeDecisionReason}</p>
        )}
        {claim.status === "Reimbursed" && (
          <p className="text-xs text-emerald-600 dark:text-emerald-400">
            Reimbursed on {claim.reimbursedOn} — ref {claim.reimbursementReference}
          </p>
        )}

        {canManagerDecide && (
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
            <Button variant="outline" onClick={() => setShowReject("manager")}>
              Reject
            </Button>
            <Button onClick={handleManagerApprove}>Approve</Button>
          </div>
        )}
        {canFinanceDecide && (
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
            <Button variant="outline" onClick={() => setShowReject("finance")}>
              Reject
            </Button>
            <Button onClick={handleFinanceApprove}>Finance Approve</Button>
          </div>
        )}
        {canReimburse && (
          <div className="flex justify-end border-t border-slate-100 pt-4 dark:border-slate-800">
            <Button onClick={() => setShowReimburse(true)}>Mark Reimbursed</Button>
          </div>
        )}

        {showReject && (
          <form className="space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800" onSubmit={handleRejectSubmit}>
            <Field label="Reason for Rejection">
              <Textarea rows={2} required value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowReject(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="danger">
                Confirm Reject
              </Button>
            </div>
          </form>
        )}

        {showReimburse && (
          <form className="space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800" onSubmit={handleReimburseSubmit}>
            <Field label="Payment Reference">
              <Input required value={reimburseRef} onChange={(e) => setReimburseRef(e.target.value)} placeholder="e.g. NEFT-2024-0912" />
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowReimburse(false)}>
                Cancel
              </Button>
              <Button type="submit">Confirm Reimbursement</Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
