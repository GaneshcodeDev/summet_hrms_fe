"use client";

import { FormEvent, useState } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Select } from "@/components/ui/form";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyRow, TBody, TableFootnote, Td, Th, THead, Table, Tr } from "@/components/ui/table";
import { departments, jobOpenings as initialJobOpenings } from "@/lib/mock-data";
import type { JobOpening } from "@/lib/types";
import { useSite, useSiteFilter } from "@/lib/site-context";

export default function RecruitmentPage() {
  const { sites, currentSiteId, currentSite, isAllSites } = useSite();
  const [jobs, setJobs] = useState<JobOpening[]>(initialJobOpenings);
  const filteredJobs = useSiteFilter(jobs);
  const [modalOpen, setModalOpen] = useState(false);
  const [viewingJob, setViewingJob] = useState<JobOpening | null>(null);

  function handleAddJob(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setJobs((prev) => [
      {
        id: String(prev.length + 1),
        title: String(form.get("title") ?? ""),
        department: String(form.get("department") ?? ""),
        location: String(form.get("location") ?? ""),
        applicants: 0,
        status: "Active",
        siteId: String(form.get("siteId") ?? (isAllSites ? sites[0]?.id : currentSiteId)),
      },
      ...prev,
    ]);
    setModalOpen(false);
    e.currentTarget.reset();
  }

  return (
    <div>
      <PageHeader
        title="Job Openings"
        description={
          isAllSites
            ? "Manage job openings and applications across all sites"
            : `Manage job openings at ${currentSite?.name}`
        }
        action={
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" /> Add Job Opening
          </Button>
        }
      />

      <Card>
        <Table>
          <THead>
            <Th>Job Title</Th>
            <Th>Department</Th>
            {isAllSites && <Th>Site</Th>}
            <Th>Location</Th>
            <Th>Applicants</Th>
            <Th>Status</Th>
            <Th>Actions</Th>
          </THead>
          <TBody>
            {filteredJobs.map((job) => (
              <Tr key={job.id}>
                <Td className="font-medium text-slate-800 dark:text-slate-100">{job.title}</Td>
                <Td>{job.department}</Td>
                {isAllSites && <Td>{sites.find((s) => s.id === job.siteId)?.name ?? "—"}</Td>}
                <Td>{job.location}</Td>
                <Td>{job.applicants}</Td>
                <Td>
                  <StatusBadge status={job.status} />
                </Td>
                <Td>
                  <button
                    onClick={() => setViewingJob(job)}
                    className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    View
                  </button>
                </Td>
              </Tr>
            ))}
            {filteredJobs.length === 0 && (
              <EmptyRow colSpan={isAllSites ? 7 : 6}>No job openings at this site yet.</EmptyRow>
            )}
          </TBody>
        </Table>
        <TableFootnote>
          Showing 1 to {filteredJobs.length} of {filteredJobs.length} entries
        </TableFootnote>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Job Opening">
        <form className="space-y-4" onSubmit={handleAddJob}>
          <Field label="Job Title">
            <Input name="title" required placeholder="e.g. Product Designer" />
          </Field>
          <Field label="Department">
            <Select name="department" required defaultValue="">
              <option value="" disabled>
                Select department
              </option>
              {departments.map((d) => (
                <option key={d.id} value={d.name}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Location">
            <Input name="location" required placeholder="e.g. Noida" />
          </Field>
          <Field label="Site">
            <Select name="siteId" required defaultValue={isAllSites ? "" : currentSiteId}>
              {isAllSites && (
                <option value="" disabled>
                  Select site
                </option>
              )}
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Add Job Opening</Button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(viewingJob)} onClose={() => setViewingJob(null)} title={viewingJob?.title ?? ""}>
        {viewingJob && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <StatusBadge status={viewingJob.status} />
              <span className="text-xs text-slate-400 dark:text-slate-500">
                {sites.find((s) => s.id === viewingJob.siteId)?.name ?? "—"}
              </span>
            </div>
            <dl className="grid grid-cols-2 gap-y-4 text-sm">
              <div>
                <dt className="text-slate-400 dark:text-slate-500">Department</dt>
                <dd className="font-medium text-slate-700 dark:text-slate-200">{viewingJob.department}</dd>
              </div>
              <div>
                <dt className="text-slate-400 dark:text-slate-500">Location</dt>
                <dd className="font-medium text-slate-700 dark:text-slate-200">{viewingJob.location}</dd>
              </div>
              <div>
                <dt className="text-slate-400 dark:text-slate-500">Applicants</dt>
                <dd className="font-medium text-slate-700 dark:text-slate-200">{viewingJob.applicants}</dd>
              </div>
              <div>
                <dt className="text-slate-400 dark:text-slate-500">Status</dt>
                <dd className="font-medium text-slate-700 dark:text-slate-200">{viewingJob.status}</dd>
              </div>
            </dl>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
              <Button variant="outline" onClick={() => setViewingJob(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
