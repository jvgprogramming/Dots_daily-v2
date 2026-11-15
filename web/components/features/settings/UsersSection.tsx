"use client";

/** Users & Roles — staff accounts with fixed, role-based module access. */

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Modal } from "@/components/ui/modal";
import { Table } from "@/components/ui/table";
import { errorMessage } from "@/lib/services/api";
import { getStaffUsers, createStaffUser, updateStaffUser, deleteStaffUser } from "@/lib/services/settings";
import type { StaffUser, StaffRole, SettingsModule, UpdateStaffUserPayload } from "@/lib/types";
import { fmtDateTime, SELECT_CLASSES, SettingField, Toggle } from "./shared";

export const ROLE_META: Record<StaffRole, { label: string; variant: "primary" | "success" | "warning" | "default" }> = {
  admin: { label: "Admin", variant: "primary" },
  staff: { label: "Staff", variant: "default" },
};

const MODULE_LABELS: Record<SettingsModule, string> = {
  patients: "Patients",
  treatments: "Treatments",
  monitoring: "Monitoring",
  medications: "Medication",
  reports: "Reports",
  settings: "Settings",
};

const ALL_MODULES: SettingsModule[] = ["patients", "treatments", "monitoring", "medications", "reports", "settings"];

/** Module access is a fixed preset per role, not a per-user checklist. */
const ROLE_MODULES: Record<StaffRole, SettingsModule[]> = {
  admin: ALL_MODULES,
  staff: ALL_MODULES.filter((m) => m !== "settings"),
};

export function UsersSection({
  passwordMin,
  showToast,
  onError,
}: {
  passwordMin: number;
  showToast: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<StaffUser | null>(null);
  const [deleting, setDeleting] = useState<StaffUser | null>(null);

  const load = useCallback(
    async (q: string) => {
      setLoading(true);
      try {
        const res = await getStaffUsers(q || undefined);
        if (res.data) setUsers(res.data.users);
      } catch (err: unknown) {
        onError(errorMessage(err, "Failed to load users"));
      } finally {
        setLoading(false);
      }
    },
    [onError]
  );

  useEffect(() => {
    const t = setTimeout(() => load(search), search ? 300 : 0);
    return () => clearTimeout(t);
  }, [search, load]);

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      const res = await deleteStaffUser(deleting.id);
      if (res.success) {
        showToast(`User ${deleting.name} removed.`);
        setDeleting(null);
        load(search);
      } else {
        onError(res.message || "Failed to delete user.");
      }
    } catch (err: unknown) {
      onError(errorMessage(err, "Failed to delete user."));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input placeholder="Search staff by name or email…" className="max-w-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add User
        </Button>
      </div>

      {loading ? (
        <Skeleton className="h-64 rounded-[12px]" />
      ) : (
        <Table
          columns={[
            {
              key: "name",
              header: "User",
              cell: (u: StaffUser) => (
                <div>
                  <p className="font-medium text-text-primary">{u.name}</p>
                  <p className="text-xs text-text-tertiary">{u.email}</p>
                </div>
              ),
            },
            {
              key: "role",
              header: "Role",
              cell: (u: StaffUser) => (
                <Badge variant={ROLE_META[u.role]?.variant ?? "default"} size="sm">
                  {ROLE_META[u.role]?.label ?? u.role}
                </Badge>
              ),
            },
            {
              key: "permissions",
              header: "Module Access",
              className: "min-w-[220px]",
              cell: (u: StaffUser) => (
                <div className="flex flex-wrap gap-1">
                  {(u.permissions ?? []).map((m) => (
                    <span key={m} className="rounded-[6px] bg-bg-subtle px-1.5 py-0.5 text-[11px] text-text-secondary">
                      {MODULE_LABELS[m] ?? m}
                    </span>
                  ))}
                </div>
              ),
            },
            { key: "last_login_at", header: "Last Login", cell: (u: StaffUser) => fmtDateTime(u.last_login_at) },
            {
              key: "is_active",
              header: "Status",
              cell: (u: StaffUser) => (
                <Badge variant={u.is_active ? "success" : "default"} size="sm">
                  {u.is_active ? "Active" : "Inactive"}
                </Badge>
              ),
            },
            {
              key: "actions",
              header: "",
              className: "text-right",
              cell: (u: StaffUser) => (
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(u)}>
                    Edit
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleting(u)} aria-label={`Remove ${u.name}`}>
                    <Trash2 className="h-3.5 w-3.5 text-danger" />
                  </Button>
                </div>
              ),
            },
          ]}
          data={users}
          keyExtractor={(u) => u.id}
          emptyMessage={search ? `No staff match "${search}".` : "No staff accounts yet — add the first one."}
        />
      )}

      {addOpen && (
        <UserFormModal
          passwordMin={passwordMin}
          onClose={() => setAddOpen(false)}
          onSaved={(msg) => {
            setAddOpen(false);
            showToast(msg);
            load(search);
          }}
        />
      )}

      {editing && (
        <UserFormModal
          user={editing}
          passwordMin={passwordMin}
          onClose={() => setEditing(null)}
          onSaved={(msg) => {
            setEditing(null);
            showToast(msg);
            load(search);
          }}
        />
      )}

      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Remove user"
        description={deleting ? `${deleting.name} will lose dashboard access.` : undefined}
        size="sm"
      >
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setDeleting(null)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            Remove
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function UserFormModal({
  user,
  passwordMin,
  onClose,
  onSaved,
}: {
  user?: StaffUser;
  passwordMin: number;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const isEdit = Boolean(user);
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<StaffRole>(user?.role ?? "staff");
  const [isActive, setIsActive] = useState(user?.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    setError("");
    setSaving(true);
    try {
      if (isEdit && user) {
        const payload: UpdateStaffUserPayload = { name, phone: phone || undefined, role, is_active: isActive };
        if (password) payload.password = password;
        const res = await updateStaffUser(user.id, payload);
        if (res.success) onSaved(`User ${name} updated.`);
        else setError(res.message || "Failed to update user.");
      } else {
        const res = await createStaffUser({ name, email, phone: phone || undefined, password, role, is_active: isActive });
        if (res.success) onSaved(`User ${name} created.`);
        else setError(res.message || "Failed to create user.");
      }
    } catch (err: unknown) {
      setError(errorMessage(err, "Failed to save user."));
    } finally {
      setSaving(false);
    }
  };

  const passwordOk = password.length === 0 ? isEdit : password.length >= passwordMin;
  const canSubmit = Boolean(name && email && passwordOk);

  return (
    <Modal
      open
      onClose={() => !saving && onClose()}
      title={isEdit ? "Edit User" : "Add User"}
      description={isEdit ? user?.email : "Create a staff account. Module access follows the role."}
      size="lg"
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <SettingField label="Full name">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </SettingField>
          <SettingField label="Email">
            <Input type="email" value={email} disabled={isEdit} onChange={(e) => setEmail(e.target.value)} />
          </SettingField>
          <SettingField label="Phone">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </SettingField>
          <SettingField
            label={isEdit ? "New password (optional)" : "Password"}
            hint={isEdit ? `Leave blank to keep current. Minimum ${passwordMin} characters.` : `Minimum ${passwordMin} characters.`}
          >
            <Input type="password" value={password} error={password.length > 0 && !passwordOk} onChange={(e) => setPassword(e.target.value)} />
          </SettingField>
          <SettingField label="Role" hint={role === "admin" ? "Full access, including users and system settings." : "Clinical workflow only — no system settings."}>
            <select className={SELECT_CLASSES} value={role} onChange={(e) => setRole(e.target.value as StaffRole)}>
              {(Object.keys(ROLE_META) as StaffRole[]).map((r) => (
                <option key={r} value={r}>
                  {ROLE_META[r].label}
                </option>
              ))}
            </select>
          </SettingField>
          <SettingField label="Account status">
            <div className="flex h-10 items-center">
              <Toggle checked={isActive} onChange={setIsActive} />
              <span className="ml-3 text-sm text-text-secondary">{isActive ? "Active" : "Inactive"}</span>
            </div>
          </SettingField>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-text-secondary">Module access</label>
          <p className="mb-2 text-[11px] text-text-tertiary">Fixed by role — change the role above to change access.</p>
          <div className="flex flex-wrap gap-1.5">
            {ROLE_MODULES[role].map((m) => (
              <span key={m} className="flex items-center gap-1 rounded-[8px] border border-primary-300 bg-primary-100/70 px-2 py-1 text-[12px] text-primary-900">
                <Check className="h-3 w-3" />
                {MODULE_LABELS[m]}
              </span>
            ))}
          </div>
        </div>

        {error && <Alert variant="danger">{error}</Alert>}

        <div className="flex justify-end gap-3 pt-1">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !canSubmit}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving…
              </>
            ) : isEdit ? (
              "Save Changes"
            ) : (
              "Create User"
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
