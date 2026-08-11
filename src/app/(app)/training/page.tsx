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
import { trainingPrograms as initialTrainingPrograms, type TrainingProgram } from "@/lib/mock-data";
import { useSite, useSiteFilter } from "@/lib/site-context";

export default function TrainingPage() {
  const { sites, currentSiteId, currentSite, isAllSites } = useSite();
  const [programs, setPrograms] = useState<TrainingProgram[]>(initialTrainingPrograms);
  const filtered = useSiteFilter(programs);
  const [modalOpen, setModalOpen] = useState(false);

  function handleAddProgram(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setPrograms((prev) => [
      {
        id: String(prev.length + 1),
        title: String(form.get("title") ?? ""),
        category: String(form.get("category") ?? ""),
        trainer: String(form.get("trainer") ?? ""),
        startDate: String(form.get("startDate") ?? ""),
        endDate: String(form.get("endDate") ?? ""),
        enrolled: 0,
        status: "Upcoming",
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
        title="Training"
        description={
          isAllSites
            ? "Employee training programs and schedules across all sites"
            : `Training programs at ${currentSite?.name}`
        }
        action={
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" /> Add Training Program
          </Button>
        }
      />

      <Card>
        <Table>
          <THead>
            <Th>Program</Th>
            <Th>Category</Th>
            {isAllSites && <Th>Site</Th>}
            <Th>Trainer</Th>
            <Th>Duration</Th>
            <Th>Enrolled</Th>
            <Th>Status</Th>
          </THead>
          <TBody>
            {filtered.map((t) => (
              <Tr key={t.id}>
                <Td className="font-medium text-slate-800 dark:text-slate-100">{t.title}</Td>
                <Td>{t.category}</Td>
                {isAllSites && <Td>{sites.find((s) => s.id === t.siteId)?.name ?? "—"}</Td>}
                <Td>{t.trainer}</Td>
                <Td>
                  {t.startDate} to {t.endDate}
                </Td>
                <Td>{t.enrolled}</Td>
                <Td>
                  <StatusBadge status={t.status} />
                </Td>
              </Tr>
            ))}
            {filtered.length === 0 && (
              <EmptyRow colSpan={isAllSites ? 7 : 6}>No training programs at this site yet.</EmptyRow>
            )}
          </TBody>
        </Table>
        <TableFootnote>
          Showing 1 to {filtered.length} of {filtered.length} entries
        </TableFootnote>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Training Program">
        <form className="space-y-4" onSubmit={handleAddProgram}>
          <Field label="Program Title">
            <Input name="title" required placeholder="e.g. React Advanced Patterns" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Category">
              <Select name="category" required defaultValue="Technical">
                <option>Technical</option>
                <option>Soft Skills</option>
                <option>Compliance</option>
                <option>Finance</option>
              </Select>
            </Field>
            <Field label="Trainer">
              <Input name="trainer" required placeholder="e.g. Rohit Sharma" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Start Date">
              <Input name="startDate" type="date" required />
            </Field>
            <Field label="End Date">
              <Input name="endDate" type="date" required />
            </Field>
          </div>
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
            <Button type="submit">Add Training Program</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
