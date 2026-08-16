"use client";

import { use, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
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
import { useTraining } from "@/lib/training-context";
import { useToast } from "@/lib/toast-context";
import { activeEnrollmentCount, nextProgramStatuses } from "@/lib/training-engine";
import type { Employee, TrainingAttendanceStatus, TrainingEnrollment, TrainingProgram, TrainingResult, TrainingSession } from "@/lib/types";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function formatDate(d?: string) {
  if (!d) return "—";
  return new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function TrainingProgramDetailPage(props: PageProps<"/training/[programId]">) {
  const { programId } = use(props.params);
  const { mappedSites, isSuperAdmin } = useSite();
  const { employees } = useEmployees();
  const {
    programById,
    advanceProgramStatus,
    canManageProgramContent,
    sessionsForProgram,
    addSession,
    enrollments,
    enrollmentsForProgram,
    enrollEmployee,
    canManagePrograms,
  } = useTraining();
  const toast = useToast();

  const program = programById(programId);
  if (!program) notFound();
  if (!isSuperAdmin && !mappedSites.some((s) => s.id === program.siteId)) notFound();

  const canManage = canManageProgramContent(program);
  const sessions = sessionsForProgram(programId);
  const programEnrollments = enrollmentsForProgram(programId);
  const enrolledCount = activeEnrollmentCount(enrollments, programId);
  const isFull = enrolledCount >= program.capacity;

  const tabs = [
    { id: "enrollments", label: "Enrollments" },
    { id: "sessions", label: "Sessions & Attendance" },
  ];
  const [active, setActive] = useState("enrollments");
  const [enrollModalOpen, setEnrollModalOpen] = useState(false);
  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [assessModal, setAssessModal] = useState<TrainingEnrollment | null>(null);
  const [completeModal, setCompleteModal] = useState<TrainingEnrollment | null>(null);

  const nextStatuses = nextProgramStatuses(program.status).filter((s) => s !== "Cancelled");
  const nextStatus = nextStatuses[0];

  function handleAdvance() {
    if (!nextStatus) return;
    const result = advanceProgramStatus(program!.id, nextStatus);
    (result.ok ? toast.success : toast.error)(result.message);
  }

  function handleCancelProgram() {
    const result = advanceProgramStatus(program!.id, "Cancelled");
    (result.ok ? toast.success : toast.error)(result.message);
  }

  function handleEnroll(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const employeeId = String(form.get("employeeId") ?? "");
    const result = enrollEmployee({ employeeId, siteId: program!.siteId, trainingProgramId: program!.id });
    (result.ok ? toast.success : toast.error)(result.message);
    if (result.ok) setEnrollModalOpen(false);
  }

  function handleAddSession(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const result = addSession({
      trainingProgramId: program!.id,
      siteId: program!.siteId,
      date: String(form.get("date") ?? ""),
      startTime: String(form.get("startTime") ?? "") || undefined,
      endTime: String(form.get("endTime") ?? "") || undefined,
      trainerId: String(form.get("trainerId") ?? "") || undefined,
      location: String(form.get("location") ?? "") || undefined,
    });
    (result.ok ? toast.success : toast.error)(result.message);
    if (result.ok) setSessionModalOpen(false);
  }

  const siteEmployees = employees.filter((e) => e.siteId === program.siteId && !programEnrollments.some((en) => en.employeeId === e.employeeId && en.status !== "Cancelled"));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/training" className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Training
        </Link>
        <PageHeader
          title={program.name}
          description={`${formatDate(program.startDate)} – ${formatDate(program.endDate)} · ${program.mode} · ${enrolledCount}/${program.capacity} enrolled${isFull ? " · Full" : ""}`}
          action={
            <div className="flex items-center gap-2">
              <StatusBadge status={program.status} />
              {canManage && nextStatus && (
                <Button size="sm" onClick={handleAdvance}>
                  Move to &ldquo;{nextStatus}&rdquo;
                </Button>
              )}
              {canManage && program.status !== "Completed" && program.status !== "Cancelled" && (
                <Button size="sm" variant="outline" onClick={handleCancelProgram}>
                  Cancel Program
                </Button>
              )}
            </div>
          }
        />
        {program.description && <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{program.description}</p>}
      </div>

      <Tabs tabs={tabs} active={active} onChange={setActive} />

      {active === "enrollments" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Enrollments</CardTitle>
            {canManage && (
              <Button size="sm" variant="outline" onClick={() => setEnrollModalOpen(true)} disabled={isFull}>
                <Plus className="h-3.5 w-3.5" /> Enroll Employee
              </Button>
            )}
          </CardHeader>
          <CardContent className="pt-0">
            <Table>
              <THead>
                <Th>Employee</Th>
                <Th>Status</Th>
                <Th>Result</Th>
                <Th>Score</Th>
                <Th>Completion Date</Th>
                <Th></Th>
              </THead>
              <TBody>
                {programEnrollments.map((en) => {
                  const employee = employees.find((e) => e.employeeId === en.employeeId);
                  return (
                    <Tr key={en.id}>
                      <Td className="font-medium text-slate-800 dark:text-slate-100">{employee?.name ?? en.employeeId}</Td>
                      <Td>
                        <StatusBadge status={en.status} />
                      </Td>
                      <Td>{en.result ? <StatusBadge status={en.result} /> : "—"}</Td>
                      <Td>{en.score ?? "—"}</Td>
                      <Td>{en.completionDate ?? "—"}</Td>
                      <Td>
                        {canManage && en.status !== "Completed" && en.status !== "Cancelled" && en.status !== "Failed" && (
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => setAssessModal(en)}>
                              Assess
                            </Button>
                            <Button size="sm" onClick={() => setCompleteModal(en)}>
                              Complete
                            </Button>
                          </div>
                        )}
                      </Td>
                    </Tr>
                  );
                })}
                {programEnrollments.length === 0 && <EmptyRow colSpan={6}>No employees enrolled yet.</EmptyRow>}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {active === "sessions" && (
        <div className="space-y-4">
          {canManage && (
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={() => setSessionModalOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> Add Session
              </Button>
            </div>
          )}
          {sessions.map((s) => (
            <SessionCard key={s.id} session={s} enrollments={programEnrollments} employees={employees} canManage={canManage} />
          ))}
          {sessions.length === 0 && <Card className="p-10 text-center text-sm text-slate-400 dark:text-slate-500">No sessions scheduled.</Card>}
        </div>
      )}

      <Modal open={enrollModalOpen} onClose={() => setEnrollModalOpen(false)} title="Enroll Employee">
        <form className="space-y-4" onSubmit={handleEnroll}>
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
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setEnrollModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Enroll</Button>
          </div>
        </form>
      </Modal>

      <Modal open={sessionModalOpen} onClose={() => setSessionModalOpen(false)} title="Add Session">
        <form className="space-y-4" onSubmit={handleAddSession}>
          <Field label="Date">
            <Input name="date" type="date" required defaultValue={program.startDate} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Start Time (optional)">
              <Input name="startTime" type="time" />
            </Field>
            <Field label="End Time (optional)">
              <Input name="endTime" type="time" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Trainer (optional)">
              <Select name="trainerId" defaultValue={program.trainerId ?? ""}>
                <option value="">— Not assigned —</option>
                {employees.filter((e) => e.siteId === program.siteId).map((e) => (
                  <option key={e.employeeId} value={e.employeeId}>
                    {e.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Location (optional)">
              <Input name="location" placeholder="e.g. Training Room 2 / Zoom" />
            </Field>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setSessionModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Add Session</Button>
          </div>
        </form>
      </Modal>

      {assessModal && <AssessModal enrollment={assessModal} onClose={() => setAssessModal(null)} />}
      {completeModal && <CompleteModal enrollment={completeModal} onClose={() => setCompleteModal(null)} />}
    </div>
  );
}

function SessionCard({
  session,
  enrollments,
  employees,
  canManage,
}: {
  session: TrainingSession;
  enrollments: TrainingEnrollment[];
  employees: Employee[];
  canManage: boolean;
}) {
  const { attendanceForSession, markAttendance } = useTraining();
  const toast = useToast();
  const records = attendanceForSession(session.id);
  const trainer = session.trainerId ? employees.find((e) => e.employeeId === session.trainerId) : undefined;
  const activeEnrollments = enrollments.filter((e) => e.status !== "Cancelled");

  function handleMark(enrollmentId: string, employeeId: string, status: TrainingAttendanceStatus) {
    const result = markAttendance({ sessionId: session.id, enrollmentId, employeeId, siteId: session.siteId, status });
    (result.ok ? toast.success : toast.error)(result.message);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {formatDate(session.date)}
          {session.startTime && ` · ${session.startTime}${session.endTime ? ` – ${session.endTime}` : ""}`}
          {session.location && ` · ${session.location}`}
        </CardTitle>
        {trainer && <p className="text-xs text-slate-400 dark:text-slate-500">Trainer: {trainer.name}</p>}
      </CardHeader>
      <CardContent className="pt-0">
        <Table>
          <THead>
            <Th>Employee</Th>
            <Th>Attendance</Th>
            {canManage && <Th></Th>}
          </THead>
          <TBody>
            {activeEnrollments.map((en) => {
              const employee = employees.find((e) => e.employeeId === en.employeeId);
              const record = records.find((r) => r.enrollmentId === en.id);
              return (
                <Tr key={en.id}>
                  <Td className="font-medium text-slate-800 dark:text-slate-100">{employee?.name ?? en.employeeId}</Td>
                  <Td>{record ? <StatusBadge status={record.status} /> : <span className="text-slate-300 dark:text-slate-600">Not marked</span>}</Td>
                  {canManage && (
                    <Td>
                      <div className="flex justify-end gap-1">
                        {(["Present", "Absent", "Late", "No Show"] as TrainingAttendanceStatus[]).map((s) => (
                          <Button key={s} size="sm" variant={record?.status === s ? "primary" : "outline"} onClick={() => handleMark(en.id, en.employeeId, s)}>
                            {s}
                          </Button>
                        ))}
                      </div>
                    </Td>
                  )}
                </Tr>
              );
            })}
            {activeEnrollments.length === 0 && <EmptyRow colSpan={canManage ? 3 : 2}>No enrollees to mark attendance for.</EmptyRow>}
          </TBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function AssessModal({ enrollment, onClose }: { enrollment: TrainingEnrollment; onClose: () => void }) {
  const { recordAssessment } = useTraining();
  const toast = useToast();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const result = recordAssessment(enrollment.id, {
      score: form.get("score") ? Number(form.get("score")) : undefined,
      result: String(form.get("result") ?? "Not Attempted") as TrainingResult,
      trainerFeedback: String(form.get("trainerFeedback") ?? "") || undefined,
      assessmentDate: String(form.get("assessmentDate") ?? todayStr()),
    });
    (result.ok ? toast.success : toast.error)(result.message);
    if (result.ok) onClose();
  }

  return (
    <Modal open onClose={onClose} title="Record Assessment">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Score (optional)">
            <Input name="score" type="number" min={0} max={100} />
          </Field>
          <Field label="Result">
            <Select name="result" required defaultValue="Passed">
              <option value="Passed">Passed</option>
              <option value="Failed">Failed</option>
              <option value="Not Attempted">Not Attempted</option>
            </Select>
          </Field>
        </div>
        <Field label="Assessment Date">
          <Input name="assessmentDate" type="date" required defaultValue={todayStr()} />
        </Field>
        <Field label="Trainer Feedback (optional)">
          <Textarea name="trainerFeedback" rows={2} />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Save Assessment</Button>
        </div>
      </form>
    </Modal>
  );
}

function CompleteModal({ enrollment, onClose }: { enrollment: TrainingEnrollment; onClose: () => void }) {
  const { completeEnrollment } = useTraining();
  const toast = useToast();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const result = completeEnrollment(enrollment.id, {
      completionDate: String(form.get("completionDate") ?? todayStr()),
      certificateReference: String(form.get("certificateReference") ?? "") || undefined,
    });
    (result.ok ? toast.success : toast.error)(result.message);
    if (result.ok) onClose();
  }

  return (
    <Modal open onClose={onClose} title="Mark Training Completed">
      <form className="space-y-4" onSubmit={handleSubmit}>
        {!enrollment.result && (
          <p className="text-xs text-amber-500">No assessment result recorded yet — record an assessment first if this training requires one.</p>
        )}
        <Field label="Completion Date">
          <Input name="completionDate" type="date" required defaultValue={todayStr()} />
        </Field>
        <Field label="Certificate Reference (optional)">
          <Input name="certificateReference" placeholder="e.g. certificate/registry number" />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Mark Completed</Button>
        </div>
      </form>
    </Modal>
  );
}
