"use client";

import { use, useState, type FormEvent } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Calculator, Check, FileSignature, X, XCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { TBody, Td, Th, THead, Table, Tr } from "@/components/ui/table";
import { employees } from "@/lib/mock-data";
import { separationReasons } from "@/lib/offboarding-data";
import { useOffboarding } from "@/lib/offboarding-context";
import { useAccessControl } from "@/lib/access-control-context";
import { useToast } from "@/lib/toast-context";
import type { ClearanceDepartment, ClearanceItemStatus } from "@/lib/types";

const clearanceStatuses: ClearanceItemStatus[] = ["Pending", "Cleared", "Flagged"];
const departmentOrder: ClearanceDepartment[] = ["IT", "Admin", "Finance", "HR"];

const openStatuses = ["Approved", "Clearance In Progress", "Settlement Pending"];

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function currency(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

export default function OffboardingCaseDetailPage(props: PageProps<"/offboarding/[id]">) {
  const { id } = use(props.params);
  const toast = useToast();
  const { currentUser } = useAccessControl();
  const {
    caseById,
    auditFor,
    canManage,
    approveSeparation,
    rejectSeparation,
    withdrawResignation,
    updateClearanceItem,
    scheduleExitInterview,
    submitExitInterviewFeedback,
    computeSettlement,
    addSettlementLineItem,
    markSettlementPaid,
    advanceLetterStatus,
    completeOffboarding,
  } = useOffboarding();

  const record = caseById(id);
  if (!record) notFound();

  const [active, setActive] = useState("overview");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [interviewModal, setInterviewModal] = useState<"schedule" | "feedback" | null>(null);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [lineItemModalOpen, setLineItemModalOpen] = useState(false);

  const isOwn = record.employeeId === currentUser.employeeId;
  const clearanceEditable = canManage && openStatuses.includes(record.status);
  const canComplete = canManage && record.clearanceItems.every((i) => i.status === "Cleared") && record.settlement.status === "Paid" && record.status !== "Completed";

  function handleApprove() {
    const result = approveSeparation(record.id);
    (result.ok ? toast.success : toast.error)(result.message);
  }

  function handleRejectSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const result = rejectSeparation(record.id, String(form.get("reason") ?? ""));
    (result.ok ? toast.success : toast.error)(result.message);
    if (result.ok) setRejectOpen(false);
  }

  function handleWithdraw() {
    const result = withdrawResignation(record.id);
    (result.ok ? toast.success : toast.error)(result.message);
  }

  function handleClearanceChange(itemId: string, status: ClearanceItemStatus) {
    const result = updateClearanceItem(record.id, itemId, status);
    if (!result.ok) toast.error(result.message);
  }

  function handleScheduleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const result = scheduleExitInterview(record.id, String(form.get("scheduledOn") ?? ""), String(form.get("conductedBy") ?? ""));
    (result.ok ? toast.success : toast.error)(result.message);
    if (result.ok) setInterviewModal(null);
  }

  function handleFeedbackSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const result = submitExitInterviewFeedback(record.id, {
      primaryReason: String(form.get("primaryReason") ?? ""),
      feedbackNotes: String(form.get("feedbackNotes") ?? ""),
      wouldRehire: form.get("wouldRehire") === "Yes",
      rating: Number(form.get("rating") ?? 0),
    });
    (result.ok ? toast.success : toast.error)(result.message);
    if (result.ok) setInterviewModal(null);
  }

  function handleComputeSettlement() {
    const result = computeSettlement(record.id);
    (result.ok ? toast.success : toast.error)(result.message);
  }

  function handleLineItemSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const result = addSettlementLineItem(
      record.id,
      String(form.get("label") ?? ""),
      form.get("type") === "Deduction" ? "Deduction" : "Earning",
      Number(form.get("amount") ?? 0),
    );
    (result.ok ? toast.success : toast.error)(result.message);
    if (result.ok) {
      setLineItemModalOpen(false);
      e.currentTarget.reset();
    }
  }

  function handlePaySubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const result = markSettlementPaid(record.id, String(form.get("reference") ?? ""));
    (result.ok ? toast.success : toast.error)(result.message);
    if (result.ok) setPayModalOpen(false);
  }

  function handleAdvanceLetter(letter: "relieving" | "experience") {
    const result = advanceLetterStatus(record.id, letter);
    (result.ok ? toast.success : toast.error)(result.message);
  }

  function handleComplete() {
    const result = completeOffboarding(record.id);
    (result.ok ? toast.success : toast.error)(result.message);
  }

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "clearance", label: "Clearance" },
    { id: "exit-interview", label: "Exit Interview" },
    { id: "settlement", label: "Full & Final Settlement" },
    { id: "documents", label: "Documents" },
  ];

  return (
    <div className="space-y-6">
      <Link
        href="/offboarding"
        className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Offboarding
      </Link>

      <PageHeader
        title={record.employee}
        description={`${record.designation} · ${record.department} · ${record.type} · Last working day ${record.lastWorkingDay}`}
        action={
          <div className="flex gap-2">
            {canManage && record.status === "Pending Approval" && (
              <>
                <Button variant="outline" onClick={() => setRejectOpen(true)}>
                  <X className="h-4 w-4" /> Reject
                </Button>
                <Button onClick={handleApprove}>
                  <Check className="h-4 w-4" /> Approve
                </Button>
              </>
            )}
            {isOwn && record.status === "Pending Approval" && (
              <Button variant="outline" onClick={handleWithdraw}>
                <XCircle className="h-4 w-4" /> Withdraw
              </Button>
            )}
            {canComplete && (
              <Button onClick={handleComplete}>
                <Check className="h-4 w-4" /> Complete Offboarding
              </Button>
            )}
          </div>
        }
      />

      <Card className="p-5">
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
          <StatusBadge status={record.status} />
          <span>Reason: <span className="font-medium text-slate-700 dark:text-slate-200">{record.reason}</span></span>
          <span>Notice: {record.noticePeriodDays} days</span>
          {record.approverName && <span>Decided by {record.approverName}</span>}
        </div>
        {record.decisionReason && (
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{record.decisionReason}</p>
        )}
      </Card>

      <Tabs tabs={tabs} active={active} onChange={setActive} />

      {active === "overview" && (
        <Card>
          <CardContent className="grid grid-cols-2 gap-4 pt-5 text-sm sm:grid-cols-3">
            <InfoRow label="Separation Type" value={record.type} />
            <InfoRow label="Resignation Date" value={record.resignationDate} />
            <InfoRow label="Last Working Day" value={record.lastWorkingDay} />
            <InfoRow label="Notice Period" value={`${record.noticePeriodDays} days`} />
            <InfoRow label="Initiated By" value={record.initiatedBy} />
            <InfoRow label="Status" value={record.status} />
          </CardContent>
          <div className="border-t border-slate-100 px-5 py-4 dark:border-slate-800">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Activity</p>
            <div className="space-y-2">
              {auditFor(record.id).map((entry) => (
                <div key={entry.id} className="flex items-start justify-between gap-4 text-sm">
                  <span className="text-slate-600 dark:text-slate-300">{entry.detail} <span className="text-xs text-slate-400 dark:text-slate-500">— {entry.actorName}</span></span>
                  <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500">{formatDateTime(entry.timestamp)}</span>
                </div>
              ))}
              {auditFor(record.id).length === 0 && <p className="text-sm text-slate-400 dark:text-slate-500">No activity yet.</p>}
            </div>
          </div>
        </Card>
      )}

      {active === "clearance" && (
        <div className="space-y-4">
          {departmentOrder.map((dept) => {
            const items = record.clearanceItems.filter((i) => i.department === dept);
            if (items.length === 0) return null;
            return (
              <Card key={dept}>
                <CardHeader>
                  <CardTitle>{dept}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-3">
                  {items.map((item) => (
                    <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 p-3 dark:border-slate-800">
                      <div>
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{item.title}</p>
                        {item.remarks && <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{item.remarks}</p>}
                        {item.clearedBy && <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">Cleared by {item.clearedBy} on {item.clearedOn}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={item.status} />
                        {clearanceEditable && (
                          <Select className="h-8 w-32 py-0 text-xs" value={item.status} onChange={(e) => handleClearanceChange(item.id, e.target.value as ClearanceItemStatus)}>
                            {clearanceStatuses.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </Select>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {active === "exit-interview" && (
        <Card>
          <CardContent className="space-y-4 pt-5">
            <div className="flex items-center justify-between">
              <StatusBadge status={record.exitInterview.status} />
              {canManage && record.exitInterview.status === "Not Scheduled" && (
                <Button size="sm" onClick={() => setInterviewModal("schedule")}>
                  Schedule Interview
                </Button>
              )}
              {canManage && record.exitInterview.status === "Scheduled" && (
                <Button size="sm" onClick={() => setInterviewModal("feedback")}>
                  Record Feedback
                </Button>
              )}
            </div>
            {record.exitInterview.scheduledOn && (
              <InfoRow label="Scheduled On" value={`${record.exitInterview.scheduledOn} with ${record.exitInterview.conductedBy ?? "—"}`} />
            )}
            {record.exitInterview.status === "Completed" && (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <InfoRow label="Primary Reason" value={record.exitInterview.primaryReason ?? "—"} />
                <InfoRow label="Would Rehire" value={record.exitInterview.wouldRehire ? "Yes" : "No"} />
                <InfoRow label="Rating" value={`${record.exitInterview.rating ?? "—"} / 5`} />
                <div className="col-span-2">
                  <p className="mb-1 text-xs font-medium text-slate-400 dark:text-slate-500">Feedback Notes</p>
                  <p className="text-sm text-slate-700 dark:text-slate-200">{record.exitInterview.feedbackNotes}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {active === "settlement" && (
        <Card>
          <CardContent className="space-y-4 pt-5">
            <div className="flex items-center justify-between">
              <StatusBadge status={record.settlement.status} />
              <div className="flex gap-2">
                {canManage && record.settlement.status === "Pending" && (
                  <Button size="sm" onClick={handleComputeSettlement}>
                    <Calculator className="h-3.5 w-3.5" /> Compute Settlement
                  </Button>
                )}
                {canManage && record.settlement.status === "Processing" && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => setLineItemModalOpen(true)}>
                      Add Line Item
                    </Button>
                    <Button size="sm" onClick={() => setPayModalOpen(true)}>
                      Mark Paid
                    </Button>
                  </>
                )}
              </div>
            </div>

            {record.settlement.lineItems.length > 0 && (
              <Table>
                <THead>
                  <Th>Item</Th>
                  <Th>Type</Th>
                  <Th>Amount</Th>
                </THead>
                <TBody>
                  {record.settlement.lineItems.map((li) => (
                    <Tr key={li.id}>
                      <Td className="font-medium text-slate-700 dark:text-slate-200">{li.label}</Td>
                      <Td>{li.type}</Td>
                      <Td className={li.type === "Deduction" ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}>
                        {li.type === "Deduction" ? "-" : "+"}
                        {currency(li.amount)}
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            )}

            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-800">
              <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Net Payable</span>
              <span className="text-lg font-bold text-slate-900 dark:text-white">{currency(record.settlement.netPayable)}</span>
            </div>
            {record.settlement.status === "Paid" && (
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Paid on {record.settlement.paidOn} · Reference {record.settlement.reference}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {active === "documents" && (
        <Card>
          <Table>
            <THead>
              <Th>Document</Th>
              <Th>Status</Th>
              <Th>Actions</Th>
            </THead>
            <TBody>
              {(["relieving", "experience"] as const).map((letter) => {
                const status = letter === "relieving" ? record.relievingLetterStatus : record.experienceLetterStatus;
                return (
                  <Tr key={letter}>
                    <Td className="font-medium text-slate-700 dark:text-slate-200">{letter === "relieving" ? "Relieving Letter" : "Experience Letter"}</Td>
                    <Td>
                      <StatusBadge status={status} />
                    </Td>
                    <Td>
                      {canManage && status !== "Sent" ? (
                        <button
                          onClick={() => handleAdvanceLetter(letter)}
                          className="flex items-center gap-1 rounded-lg bg-indigo-50 px-2.5 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400"
                        >
                          <FileSignature className="h-3.5 w-3.5" /> {status === "Not Generated" ? "Generate" : "Send"}
                        </button>
                      ) : (
                        <span className="text-xs text-slate-300 dark:text-slate-600">—</span>
                      )}
                    </Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>
        </Card>
      )}

      <Modal open={rejectOpen} onClose={() => setRejectOpen(false)} title="Reject Separation Request">
        <form className="space-y-4" onSubmit={handleRejectSubmit}>
          <Field label="Reason">
            <Textarea name="reason" rows={3} required placeholder="e.g. Retention conversation requested" />
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

      <Modal open={interviewModal === "schedule"} onClose={() => setInterviewModal(null)} title="Schedule Exit Interview">
        <form className="space-y-4" onSubmit={handleScheduleSubmit}>
          <Field label="Scheduled On">
            <Input name="scheduledOn" type="date" required />
          </Field>
          <Field label="Conducted By">
            <Select name="conductedBy" required defaultValue="">
              <option value="" disabled>
                Select interviewer
              </option>
              {employees.map((e) => (
                <option key={e.employeeId} value={e.name}>
                  {e.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setInterviewModal(null)}>
              Cancel
            </Button>
            <Button type="submit">Schedule</Button>
          </div>
        </form>
      </Modal>

      <Modal open={interviewModal === "feedback"} onClose={() => setInterviewModal(null)} title="Record Exit Interview Feedback">
        <form className="space-y-4" onSubmit={handleFeedbackSubmit}>
          <Field label="Primary Reason">
            <Select name="primaryReason" required defaultValue={record.reason}>
              {separationReasons.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </Select>
          </Field>
          <Field label="Feedback Notes">
            <Textarea name="feedbackNotes" rows={3} required placeholder="Key takeaways from the conversation" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Would Rehire?">
              <Select name="wouldRehire" required defaultValue="Yes">
                <option>Yes</option>
                <option>No</option>
              </Select>
            </Field>
            <Field label="Rating (1-5)">
              <Input name="rating" type="number" min={1} max={5} required defaultValue={4} />
            </Field>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setInterviewModal(null)}>
              Cancel
            </Button>
            <Button type="submit">Save Feedback</Button>
          </div>
        </form>
      </Modal>

      <Modal open={lineItemModalOpen} onClose={() => setLineItemModalOpen(false)} title="Add Settlement Line Item">
        <form className="space-y-4" onSubmit={handleLineItemSubmit}>
          <Field label="Label">
            <Input name="label" required placeholder="e.g. Asset non-return charge" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Type">
              <Select name="type" required defaultValue="Deduction">
                <option>Earning</option>
                <option>Deduction</option>
              </Select>
            </Field>
            <Field label="Amount">
              <Input name="amount" type="number" min={1} required />
            </Field>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setLineItemModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Add</Button>
          </div>
        </form>
      </Modal>

      <Modal open={payModalOpen} onClose={() => setPayModalOpen(false)} title="Mark Settlement Paid">
        <form className="space-y-4" onSubmit={handlePaySubmit}>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Net payable: <span className="font-semibold text-slate-800 dark:text-slate-100">{currency(record.settlement.netPayable)}</span>
          </p>
          <Field label="Payment Reference">
            <Input name="reference" required placeholder="e.g. NEFT-2024-0912" />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setPayModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Mark Paid</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-400 dark:text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-slate-700 dark:text-slate-200">{value}</p>
    </div>
  );
}
