"use client";

import { use, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Ban, CheckCircle2, FileSignature, Upload, XCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Select, Textarea } from "@/components/ui/form";
import { TBody, Td, Th, THead, Table, Tr } from "@/components/ui/table";
import { employees } from "@/lib/mock-data";
import { useOnboarding } from "@/lib/onboarding-context";
import { useAccessControl } from "@/lib/access-control-context";
import { useToast } from "@/lib/toast-context";
import type { OnboardingDocument, OnboardingTask, OnboardingTaskCategory, OnboardingTaskStatus } from "@/lib/types";

const categoryOrder: OnboardingTaskCategory[] = ["HR", "IT", "Admin", "Manager", "Employee"];
const taskStatuses: OnboardingTaskStatus[] = ["Pending", "In Progress", "Completed", "Not Applicable"];

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export default function OnboardingCaseDetailPage(props: PageProps<"/onboarding/[id]">) {
  const { id } = use(props.params);
  const toast = useToast();
  const { currentUser } = useAccessControl();
  const {
    caseById,
    auditFor,
    progressFor,
    canManage,
    canActOnTask,
    canActOnDocuments,
    updateTaskStatus,
    uploadDocument,
    verifyDocument,
    sendForSignature,
    markSigned,
    completeOnboarding,
    cancelOnboarding,
  } = useOnboarding();

  const record = caseById(id);
  if (!record) notFound();

  const [active, setActive] = useState("checklist");
  const [rejectTarget, setRejectTarget] = useState<OnboardingDocument | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const buddy = record.buddyId ? employees.find((e) => e.employeeId === record.buddyId) : undefined;
  const progress = progressFor(record);
  const isTerminal = record.status === "Completed" || record.status === "Cancelled";

  function handleTaskStatusChange(task: OnboardingTask, status: OnboardingTaskStatus) {
    const result = updateTaskStatus(record.id, task.id, status);
    if (!result.ok) toast.error(result.message);
  }

  function handleUploadClick(docId: string) {
    fileInputs.current[docId]?.click();
  }

  function handleFileChosen(docId: string, file: File | undefined) {
    if (!file) return;
    const result = uploadDocument(record.id, docId, file.name);
    (result.ok ? toast.success : toast.error)(result.message);
  }

  function handleVerify(doc: OnboardingDocument) {
    const result = verifyDocument(record.id, doc.id, "Verified");
    (result.ok ? toast.success : toast.error)(result.message);
  }

  function handleRejectSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!rejectTarget) return;
    const form = new FormData(e.currentTarget);
    const result = verifyDocument(record.id, rejectTarget.id, "Rejected", String(form.get("reason") ?? ""));
    (result.ok ? toast.success : toast.error)(result.message);
    if (result.ok) setRejectTarget(null);
  }

  function handleSendForSignature(doc: OnboardingDocument) {
    const result = sendForSignature(record.id, doc.id);
    (result.ok ? toast.success : toast.error)(result.message);
  }

  function handleMarkSigned(doc: OnboardingDocument) {
    const result = markSigned(record.id, doc.id);
    (result.ok ? toast.success : toast.error)(result.message);
  }

  function handleComplete() {
    const result = completeOnboarding(record.id);
    (result.ok ? toast.success : toast.error)(result.message);
  }

  function handleCancelSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const result = cancelOnboarding(record.id, String(form.get("reason") ?? ""));
    (result.ok ? toast.success : toast.error)(result.message);
    if (result.ok) setCancelOpen(false);
  }

  const tabs = [
    { id: "checklist", label: "Checklist" },
    { id: "documents", label: "Documents & E-Sign" },
    { id: "activity", label: "Activity" },
  ];

  return (
    <div className="space-y-6">
      <Link
        href="/onboarding"
        className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Onboarding
      </Link>

      <PageHeader
        title={record.candidateName}
        description={`${record.designation} · ${record.department} · Joining ${record.joiningDate}`}
        action={
          canManage &&
          !isTerminal && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setCancelOpen(true)}>
                <Ban className="h-4 w-4" /> Cancel
              </Button>
              <Button onClick={handleComplete}>
                <CheckCircle2 className="h-4 w-4" /> Complete Onboarding
              </Button>
            </div>
          )
        }
      />

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
            <StatusBadge status={record.status} />
            {buddy && <span>Buddy: <span className="font-medium text-slate-700 dark:text-slate-200">{buddy.name}</span></span>}
            <span>{record.candidateEmail}</span>
            <span>{record.candidatePhone}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-2 w-40 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div className="h-full rounded-full bg-indigo-600 dark:bg-indigo-400" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{progress}%</span>
          </div>
        </div>
        {record.status === "Cancelled" && record.cancelledReason && (
          <p className="mt-3 text-sm text-rose-600 dark:text-rose-400">Cancelled — {record.cancelledReason}</p>
        )}
      </Card>

      <Tabs tabs={tabs} active={active} onChange={setActive} />

      {active === "checklist" && (
        <div className="space-y-4">
          {categoryOrder.map((category) => {
            const tasks = record.tasks.filter((t) => t.category === category);
            if (tasks.length === 0) return null;
            return (
              <Card key={category}>
                <CardHeader>
                  <CardTitle>{category}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-3">
                  {tasks.map((task) => {
                    const editable = canActOnTask(record, task) && !isTerminal;
                    return (
                      <div
                        key={task.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 p-3 dark:border-slate-800"
                      >
                        <div>
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                            {task.title}
                            {task.mandatory && <span className="ml-2 text-xs font-normal text-rose-500">required</span>}
                          </p>
                          {task.status === "Completed" && task.completedBy && (
                            <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                              Completed by {task.completedBy} on {task.completedOn}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={task.status} />
                          {editable && (
                            <Select
                              className="h-8 w-36 py-0 text-xs"
                              value={task.status}
                              onChange={(e) => handleTaskStatusChange(task, e.target.value as OnboardingTaskStatus)}
                            >
                              {taskStatuses.map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </Select>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {active === "documents" && (
        <Card>
          <Table>
            <THead>
              <Th>Document</Th>
              <Th>Status</Th>
              <Th>Signature</Th>
              <Th>File</Th>
              <Th>Actions</Th>
            </THead>
            <TBody>
              {record.documents.map((doc) => {
                const canUpload = canActOnDocuments(record) && !isTerminal && (doc.status === "Pending" || doc.status === "Rejected");
                const canVerify = canManage && !isTerminal && doc.status === "Uploaded";
                const canSend =
                  canManage && !isTerminal && doc.status === "Verified" && doc.signatureStatus === "Not Sent";
                const canMarkSigned =
                  !isTerminal &&
                  (canManage || record.employeeId === currentUser.employeeId) &&
                  (doc.signatureStatus === "Sent" || doc.signatureStatus === "Viewed");
                return (
                  <Tr key={doc.id}>
                    <Td className="font-medium text-slate-700 dark:text-slate-200">{doc.docType}</Td>
                    <Td>
                      <StatusBadge status={doc.status} />
                      {doc.status === "Rejected" && doc.rejectionReason && (
                        <p className="mt-1 max-w-[200px] text-xs text-slate-400 dark:text-slate-500">{doc.rejectionReason}</p>
                      )}
                    </Td>
                    <Td>
                      <StatusBadge status={doc.signatureStatus} />
                    </Td>
                    <Td>
                      {doc.fileName ?? <span className="text-slate-300 dark:text-slate-600">—</span>}
                    </Td>
                    <Td>
                      <div className="flex flex-wrap items-center gap-2">
                        {canUpload && (
                          <>
                            <input
                              ref={(el) => {
                                fileInputs.current[doc.id] = el;
                              }}
                              type="file"
                              className="hidden"
                              onChange={(e) => handleFileChosen(doc.id, e.target.files?.[0])}
                            />
                            <button
                              onClick={() => handleUploadClick(doc.id)}
                              className="flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                            >
                              <Upload className="h-3.5 w-3.5" /> Upload
                            </button>
                          </>
                        )}
                        {canVerify && (
                          <>
                            <button
                              onClick={() => handleVerify(doc)}
                              className="flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" /> Verify
                            </button>
                            <button
                              onClick={() => setRejectTarget(doc)}
                              className="flex items-center gap-1 rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-400"
                            >
                              <XCircle className="h-3.5 w-3.5" /> Reject
                            </button>
                          </>
                        )}
                        {canSend && (
                          <button
                            onClick={() => handleSendForSignature(doc)}
                            className="flex items-center gap-1 rounded-lg bg-indigo-50 px-2.5 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400"
                          >
                            <FileSignature className="h-3.5 w-3.5" /> Send for Signature
                          </button>
                        )}
                        {canMarkSigned && (
                          <button
                            onClick={() => handleMarkSigned(doc)}
                            className="flex items-center gap-1 rounded-lg bg-indigo-50 px-2.5 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400"
                          >
                            <FileSignature className="h-3.5 w-3.5" /> Mark Signed
                          </button>
                        )}
                        {!canUpload && !canVerify && !canSend && !canMarkSigned && (
                          <span className="text-xs text-slate-300 dark:text-slate-600">—</span>
                        )}
                      </div>
                    </Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>
        </Card>
      )}

      {active === "activity" && (
        <Card>
          <div className="divide-y divide-slate-50 dark:divide-slate-800/60">
            {auditFor(record.id).map((entry) => (
              <div key={entry.id} className="flex items-start justify-between gap-4 px-5 py-3.5">
                <div>
                  <p className="text-sm text-slate-700 dark:text-slate-200">{entry.detail}</p>
                  <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">by {entry.actorName}</p>
                </div>
                <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500">{formatDateTime(entry.timestamp)}</span>
              </div>
            ))}
            {auditFor(record.id).length === 0 && (
              <p className="px-5 py-10 text-center text-sm text-slate-400 dark:text-slate-500">No activity yet.</p>
            )}
          </div>
        </Card>
      )}

      <Modal open={Boolean(rejectTarget)} onClose={() => setRejectTarget(null)} title="Reject Document">
        {rejectTarget && (
          <form className="space-y-4" onSubmit={handleRejectSubmit}>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Rejecting <span className="font-medium text-slate-700 dark:text-slate-200">{rejectTarget.docType}</span>. Let the
              candidate know what needs fixing.
            </p>
            <Field label="Reason">
              <Textarea name="reason" rows={3} required placeholder="e.g. Image unclear, please re-upload" />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setRejectTarget(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="danger">
                Reject
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancel Onboarding">
        <form className="space-y-4" onSubmit={handleCancelSubmit}>
          <Field label="Reason">
            <Textarea name="reason" rows={3} required placeholder="e.g. Candidate declined the offer" />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setCancelOpen(false)}>
              Keep Case
            </Button>
            <Button type="submit" variant="danger">
              Cancel Onboarding
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
