"use client";

import { FormEvent, useMemo, useState } from "react";
import { Plus, Star } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Select } from "@/components/ui/form";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyRow, TBody, TableFootnote, Td, Th, THead, Table, Tr } from "@/components/ui/table";
import { employees, performanceReviews as initialReviews } from "@/lib/mock-data";
import type { PerformanceReview } from "@/lib/types";
import { useSite, useSiteFilter } from "@/lib/site-context";

export default function PerformancePage() {
  const { sites, currentSiteId, currentSite, isAllSites } = useSite();
  const [reviews, setReviews] = useState<PerformanceReview[]>(initialReviews);
  const filteredReviews = useSiteFilter(reviews);
  const [modalOpen, setModalOpen] = useState(false);

  const siteEmployees = useMemo(
    () => (isAllSites ? employees : employees.filter((e) => e.siteId === currentSiteId)),
    [currentSiteId, isAllSites],
  );

  function handleInitiateReview(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const employeeName = String(form.get("employee") ?? "");
    const employeeSiteId = employees.find((emp) => emp.name === employeeName)?.siteId ?? currentSiteId;
    setReviews((prev) => [
      {
        id: String(prev.length + 1),
        employee: employeeName,
        period: String(form.get("period") ?? ""),
        status: "Pending",
        siteId: employeeSiteId,
      },
      ...prev,
    ]);
    setModalOpen(false);
    e.currentTarget.reset();
  }

  return (
    <div>
      <PageHeader
        title="Performance Reviews"
        description={
          isAllSites
            ? "Manage performance reviews across all sites"
            : `Manage performance reviews at ${currentSite?.name}`
        }
        action={
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" /> Initiate Review
          </Button>
        }
      />

      <Card>
        <Table>
          <THead>
            <Th>Employee</Th>
            {isAllSites && <Th>Site</Th>}
            <Th>Review Period</Th>
            <Th>Rating</Th>
            <Th>Status</Th>
          </THead>
          <TBody>
            {filteredReviews.map((r) => (
              <Tr key={r.id}>
                <Td className="font-medium text-slate-800 dark:text-slate-100">{r.employee}</Td>
                {isAllSites && <Td>{sites.find((s) => s.id === r.siteId)?.name ?? "—"}</Td>}
                <Td>{r.period}</Td>
                <Td>
                  {r.rating ? (
                    <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-200">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      {r.rating}/5
                    </span>
                  ) : (
                    <span className="text-slate-300 dark:text-slate-600">—</span>
                  )}
                </Td>
                <Td>
                  <StatusBadge status={r.status} />
                </Td>
              </Tr>
            ))}
            {filteredReviews.length === 0 && (
              <EmptyRow colSpan={isAllSites ? 5 : 4}>No performance reviews at this site yet.</EmptyRow>
            )}
          </TBody>
        </Table>
        <TableFootnote>
          Showing 1 to {filteredReviews.length} of {filteredReviews.length} entries
        </TableFootnote>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Initiate Review">
        <form className="space-y-4" onSubmit={handleInitiateReview}>
          <Field label="Employee">
            <Select name="employee" required defaultValue="">
              <option value="" disabled>
                Select employee
              </option>
              {siteEmployees.map((e) => (
                <option key={e.id} value={e.name}>
                  {e.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Review Period">
            <Input name="period" required placeholder="e.g. Jul 2024 - Dec 2024" />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Initiate Review</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
