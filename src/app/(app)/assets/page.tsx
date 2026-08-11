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
import { assets as initialAssets, type Asset } from "@/lib/mock-data";
import { useSite, useSiteFilter } from "@/lib/site-context";

export default function AssetsPage() {
  const { sites, currentSiteId, currentSite, isAllSites } = useSite();
  const [assets, setAssets] = useState<Asset[]>(initialAssets);
  const filtered = useSiteFilter(assets);
  const [modalOpen, setModalOpen] = useState(false);

  function handleAddAsset(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const assignedTo = String(form.get("assignedTo") ?? "").trim();
    setAssets((prev) => [
      {
        id: String(prev.length + 1),
        name: String(form.get("name") ?? ""),
        type: String(form.get("type") ?? ""),
        serialNumber: String(form.get("serialNumber") ?? ""),
        assignedTo: assignedTo || "—",
        assignedDate: assignedTo ? new Date().toISOString().slice(0, 10) : "—",
        status: assignedTo ? "Assigned" : "Available",
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
        title="Assets"
        description={
          isAllSites ? "Company assets and allocations across all sites" : `Assets at ${currentSite?.name}`
        }
        action={
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" /> Add Asset
          </Button>
        }
      />

      <Card>
        <Table>
          <THead>
            <Th>Asset</Th>
            <Th>Type</Th>
            {isAllSites && <Th>Site</Th>}
            <Th>Serial Number</Th>
            <Th>Assigned To</Th>
            <Th>Assigned Date</Th>
            <Th>Status</Th>
          </THead>
          <TBody>
            {filtered.map((a) => (
              <Tr key={a.id}>
                <Td className="font-medium text-slate-800 dark:text-slate-100">{a.name}</Td>
                <Td>{a.type}</Td>
                {isAllSites && <Td>{sites.find((s) => s.id === a.siteId)?.name ?? "—"}</Td>}
                <Td>{a.serialNumber}</Td>
                <Td>{a.assignedTo}</Td>
                <Td>{a.assignedDate}</Td>
                <Td>
                  <StatusBadge status={a.status} />
                </Td>
              </Tr>
            ))}
            {filtered.length === 0 && (
              <EmptyRow colSpan={isAllSites ? 7 : 6}>No assets at this site yet.</EmptyRow>
            )}
          </TBody>
        </Table>
        <TableFootnote>
          Showing 1 to {filtered.length} of {filtered.length} entries
        </TableFootnote>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Asset">
        <form className="space-y-4" onSubmit={handleAddAsset}>
          <Field label="Asset Name">
            <Input name="name" required placeholder='e.g. MacBook Pro 14"' />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Type">
              <Select name="type" required defaultValue="Laptop">
                <option>Laptop</option>
                <option>Mobile</option>
                <option>Monitor</option>
                <option>Accessory</option>
              </Select>
            </Field>
            <Field label="Serial Number">
              <Input name="serialNumber" required placeholder="e.g. MBP14-2201" />
            </Field>
          </div>
          <Field label="Assigned To (optional)">
            <Input name="assignedTo" placeholder="Leave blank to keep it available" />
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
            <Button type="submit">Add Asset</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
