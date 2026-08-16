"use client";

import { use, useState, type FormEvent } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Plus, Receipt, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { StatusBadge } from "@/components/ui/status-badge";
import { useSite } from "@/lib/site-context";
import { useEmployees } from "@/lib/employee-context";
import { useMasters } from "@/lib/master-context";
import { useAccessControl } from "@/lib/access-control-context";
import { useExpense } from "@/lib/expense-context";
import { useApprovals } from "@/lib/approval-context";
import { useToast } from "@/lib/toast-context";

function currency(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}
function formatDate(d?: string) {
  if (!d) return "—";
  return new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function ExpenseClaimDetailPage(props: PageProps<"/expenses/claims/[claimId]">) {
  const { claimId } = use(props.params);
  const { mappedSites, isSuperAdmin, sites } = useSite();
  const { getEmployeeByEmployeeId } = useEmployees();
  const { recordsOfType } = useMasters();
  const { currentUser } = useAccessControl();
  const toast = useToast();
  const {
    expenseClaims,
    travelRequests,
    canManagerDecide,
    canFinanceDecide,
    hasBroadClaimScope,
    addExpenseItem,
    removeExpenseItem,
    submitClaim,
    managerDecideClaim,
    financeDecideClaim,
    markReimbursed,
    cancelClaim,
  } = useExpense();
  const { instanceFor } = useApprovals();

  const claim = expenseClaims.find((c) => c.id === claimId);
  if (!claim) notFound();
  if (!isSuperAdmin && !mappedSites.some((s) => s.id === claim.siteId)) notFound();

  const [showReject, setShowReject] = useState<"manager" | "finance" | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showReimburse, setShowReimburse] = useState(false);
  const [showFinanceApprove, setShowFinanceApprove] = useState(false);

  const employee = getEmployeeByEmployeeId(claim.employeeId);
  const travelRequest = claim.travelRequestId ? travelRequests.find((r) => r.id === claim.travelRequestId) : undefined;
  const instance = instanceFor("Expense", claim.id);
  const categories = recordsOfType("ExpenseCategory").filter((r) => r.status === "Active");
  const categoryName = (id: string) => recordsOfType("ExpenseCategory").find((c) => c.id === id)?.name ?? id;

  const isOwner = claim.employeeId === currentUser.employeeId;
  const isDraft = claim.status === "Draft";
  const canManager = canManagerDecide(claim);
  const canFinance = canFinanceDecide(claim);
  const canReimburse = hasBroadClaimScope && claim.status === "Finance Approved";
  const canCancel = isOwner && isDraft;

  function handleAddItem(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const result = addExpenseItem(claim!.id, {
      date: String(form.get("date") ?? ""),
      categoryId: String(form.get("categoryId") ?? ""),
      amount: Number(form.get("amount") ?? 0),
      description: String(form.get("description") ?? ""),
      receiptReference: String(form.get("receiptReference") ?? "") || undefined,
      overLimitNote: String(form.get("overLimitNote") ?? "") || undefined,
    });
    (result.ok ? toast.success : toast.error)(result.message);
    if (result.ok) e.currentTarget.reset();
  }

  function handleRemoveItem(itemId: string) {
    const result = removeExpenseItem(claim!.id, itemId);
    if (!result.ok) toast.error(result.message);
  }

  function handleSubmitClaim() {
    const result = submitClaim(claim!.id);
    (result.ok ? toast.success : toast.error)(result.message);
  }

  function handleCancelClaim() {
    const result = cancelClaim(claim!.id);
    (result.ok ? toast.success : toast.error)(result.message);
  }

  function handleManagerApprove() {
    const result = managerDecideClaim(claim!.id, "Manager Approved");
    (result.ok ? toast.success : toast.error)(result.message);
  }

  function handleFinanceApproveSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const approvedAmount = form.get("approvedAmount") ? Number(form.get("approvedAmount")) : undefined;
    const result = financeDecideClaim(claim!.id, "Finance Approved", undefined, approvedAmount);
    (result.ok ? toast.success : toast.error)(result.message);
    if (result.ok) setShowFinanceApprove(false);
  }

  function handleRejectSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const result = showReject === "manager" ? managerDecideClaim(claim!.id, "Rejected", rejectReason) : financeDecideClaim(claim!.id, "Rejected", rejectReason);
    (result.ok ? toast.success : toast.error)(result.message);
    if (result.ok) {
      setShowReject(null);
      setRejectReason("");
    }
  }

  function handleReimburseSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const result = markReimbursed(claim!.id, {
      reference: String(form.get("reference") ?? ""),
      amount: form.get("amount") ? Number(form.get("amount")) : undefined,
      method: String(form.get("method") ?? "") || undefined,
    });
    (result.ok ? toast.success : toast.error)(result.message);
    if (result.ok) setShowReimburse(false);
  }

  const outstanding = (claim.approvedAmount ?? 0) - (claim.reimbursedAmount ?? 0);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/expenses" className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Expenses
        </Link>
        <PageHeader
          title={claim.title}
          description={`${claim.id} · ${employee?.name ?? claim.employee} · ${sites.find((s) => s.id === claim.siteId)?.name ?? "—"}`}
          action={<StatusBadge status={claim.status} />}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Expense Lines</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <div className="space-y-2">
              {claim.items.map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 p-3 text-sm dark:border-slate-800">
                  <div>
                    <p className="font-medium text-slate-700 dark:text-slate-200">
                      {categoryName(item.categoryId)} · {item.description}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      {formatDate(item.date)} · {item.receiptReference ? `Receipt: ${item.receiptReference}` : "No receipt"}
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
              <span>Total (derived from lines)</span>
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
                    <Select name="categoryId" required defaultValue="">
                      <option value="" disabled>
                        Select category
                      </option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
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
                  <Field label="Receipt Reference (optional)">
                    <Input name="receiptReference" placeholder="e.g. INV-2026-0042" />
                  </Field>
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
                <Button variant="outline" onClick={handleCancelClaim} disabled={!canCancel}>
                  Discard Draft
                </Button>
                <Button onClick={handleSubmitClaim}>Submit for Approval</Button>
              </div>
            )}

            {(canManager || canFinance || canReimburse) && (
              <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                {canManager && (
                  <>
                    <Button variant="outline" onClick={() => setShowReject("manager")}>
                      Reject
                    </Button>
                    <Button onClick={handleManagerApprove}>Approve</Button>
                  </>
                )}
                {canFinance && (
                  <>
                    <Button variant="outline" onClick={() => setShowReject("finance")}>
                      Reject
                    </Button>
                    <Button onClick={() => setShowFinanceApprove(true)}>Finance Approve</Button>
                  </>
                )}
                {canReimburse && <Button onClick={() => setShowReimburse(true)}>Mark Reimbursed</Button>}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Reimbursement</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-0 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 dark:text-slate-500">Claimed</span>
                <span className="font-medium text-slate-700 dark:text-slate-200">{currency(claim.totalAmount)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 dark:text-slate-500">Approved</span>
                <span className="font-medium text-slate-700 dark:text-slate-200">{claim.approvedAmount !== undefined ? currency(claim.approvedAmount) : "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 dark:text-slate-500">Reimbursed</span>
                <span className="font-medium text-emerald-600 dark:text-emerald-400">{claim.reimbursedAmount !== undefined ? currency(claim.reimbursedAmount) : "—"}</span>
              </div>
              {claim.approvedAmount !== undefined && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 dark:text-slate-500">Outstanding</span>
                  <span className="font-medium text-amber-600 dark:text-amber-400">{currency(outstanding)}</span>
                </div>
              )}
              {claim.managerDecisionReason && <p className="border-t border-slate-100 pt-2 text-xs text-slate-400 dark:border-slate-800 dark:text-slate-500">Manager: {claim.managerDecisionReason}</p>}
              {claim.financeDecisionReason && <p className="text-xs text-slate-400 dark:text-slate-500">Finance: {claim.financeDecisionReason}</p>}
              {claim.status === "Reimbursed" && (
                <p className="border-t border-slate-100 pt-2 text-xs text-emerald-600 dark:border-slate-800 dark:text-emerald-400">
                  Reimbursed {formatDate(claim.reimbursedOn)} · ref {claim.reimbursementReference}
                  {claim.reimbursementMethod ? ` · ${claim.reimbursementMethod}` : ""}
                  {claim.reimbursedBy ? ` · by ${claim.reimbursedBy}` : ""}
                </p>
              )}
              {travelRequest && (
                <p className="border-t border-slate-100 pt-2 text-xs dark:border-slate-800">
                  Linked to travel request{" "}
                  <Link href={`/expenses/travel/${travelRequest.id}`} className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                    {travelRequest.purpose}
                  </Link>
                </p>
              )}
            </CardContent>
          </Card>

          {instance && instance.actions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Approval History</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {instance.actions
                  .slice()
                  .reverse()
                  .map((a) => (
                    <div key={a.id} className="border-b border-slate-100 pb-2 text-xs last:border-0 dark:border-slate-800">
                      <p className="text-slate-700 dark:text-slate-200">
                        <span className="font-medium">{a.approverType === "REPORTING_MANAGER" ? "Manager" : "Finance"}</span> — {a.action}
                        {a.comment ? ` (${a.comment})` : ""}
                      </p>
                      <p className="text-slate-400 dark:text-slate-500">
                        {a.actorName} · {new Date(a.timestamp).toLocaleString("en-IN")}
                      </p>
                    </div>
                  ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Modal open={showReject !== null} onClose={() => setShowReject(null)} title="Reject Claim">
        <form className="space-y-4" onSubmit={handleRejectSubmit}>
          <Field label="Reason for Rejection">
            <Textarea rows={2} required value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowReject(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger">
              Confirm Reject
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={showFinanceApprove} onClose={() => setShowFinanceApprove(false)} title="Finance Approve">
        <form className="space-y-4" onSubmit={handleFinanceApproveSubmit}>
          <Field label={`Approved Amount (claimed: ${currency(claim.totalAmount)})`}>
            <Input name="approvedAmount" type="number" min={1} max={claim.totalAmount} defaultValue={claim.totalAmount} />
          </Field>
          <p className="text-xs text-slate-400 dark:text-slate-500">Reduce this only for a genuine partial approval — the full claimed amount is used by default.</p>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowFinanceApprove(false)}>
              Cancel
            </Button>
            <Button type="submit">Approve</Button>
          </div>
        </form>
      </Modal>

      <Modal open={showReimburse} onClose={() => setShowReimburse(false)} title="Mark Reimbursed">
        <form className="space-y-4" onSubmit={handleReimburseSubmit}>
          <Field label="Payment Reference">
            <Input name="reference" required placeholder="e.g. NEFT-2026-0912" />
          </Field>
          <Field label={`Reimbursed Amount (approved: ${currency(claim.approvedAmount ?? claim.totalAmount)})`}>
            <Input name="amount" type="number" min={1} max={claim.approvedAmount ?? claim.totalAmount} defaultValue={claim.approvedAmount ?? claim.totalAmount} />
          </Field>
          <Field label="Payment Method (optional)">
            <Input name="method" placeholder="e.g. NEFT, UPI, Cash" />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowReimburse(false)}>
              Cancel
            </Button>
            <Button type="submit">Confirm Reimbursement</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
