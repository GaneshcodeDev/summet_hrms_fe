"use client";

import { FormEvent, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Select } from "@/components/ui/form";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyRow, TBody, Td, Th, THead, Table, Tr } from "@/components/ui/table";
import { Can } from "@/components/auth/permission-gate";
import { departments, designations as initialDesignations } from "@/lib/mock-data";
import type { Designation } from "@/lib/types";
import { useSite } from "@/lib/site-context";

export default function DesignationsPage() {
  const { sites, currentSiteId, isAllSites } = useSite();
  const [designations, setDesignations] = useState<Designation[]>(initialDesignations);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const filtered = useMemo(() => {
    return designations.filter((d) => {
      const matchesSite = isAllSites || d.siteId === currentSiteId;
      const matchesSearch = !search || d.name.toLowerCase().includes(search.toLowerCase());
      return matchesSite && matchesSearch;
    });
  }, [designations, search, currentSiteId, isAllSites]);

  function handleAdd(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setDesignations((prev) => [
      ...prev,
      {
        id: String(prev.length + 1),
        name: String(form.get("name") ?? ""),
        department: String(form.get("department") ?? ""),
        grade: String(form.get("grade") ?? ""),
        employeeCount: 0,
        status: "Active",
        siteId: String(form.get("siteId") ?? (isAllSites ? sites[0]?.id : currentSiteId)),
      },
    ]);
    setModalOpen(false);
    e.currentTarget.reset();
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {filtered.length} designation{filtered.length === 1 ? "" : "s"} {isAllSites ? "across all sites" : "at this site"}
        </p>
        <Can module="Organization" action="create">
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" /> Add Designation
          </Button>
        </Can>
      </div>

      <Card>
        <div className="flex items-center gap-3 border-b border-slate-100 p-4 dark:border-slate-800">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search designations..."
              className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
        </div>
        <Table>
          <THead>
            <Th>Designation Name</Th>
            <Th>Department</Th>
            {isAllSites && <Th>Site</Th>}
            <Th>Grade</Th>
            <Th>Employees</Th>
            <Th>Status</Th>
          </THead>
          <TBody>
            {filtered.map((d) => (
              <Tr key={d.id} hoverable>
                <Td className="font-medium text-slate-800 dark:text-slate-100">{d.name}</Td>
                <Td>{d.department}</Td>
                {isAllSites && <Td>{sites.find((s) => s.id === d.siteId)?.name ?? "—"}</Td>}
                <Td>{d.grade}</Td>
                <Td>{d.employeeCount}</Td>
                <Td>
                  <StatusBadge status={d.status} />
                </Td>
              </Tr>
            ))}
            {filtered.length === 0 && <EmptyRow colSpan={isAllSites ? 6 : 5}>No designations match your filters.</EmptyRow>}
          </TBody>
        </Table>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Designation">
        <form className="space-y-4" onSubmit={handleAdd}>
          <Field label="Designation Name">
            <Input name="name" required placeholder="e.g. Product Manager" />
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
          <Field label="Grade">
            <Input name="grade" required placeholder="e.g. Grade 7" />
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
            <Button type="submit">Add Designation</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
