import { useEffect, useMemo, useState } from "react";
import { Users, Plus, Save, Trash2 } from "lucide-react";
import { useI18n } from "../../i18n/use-i18n";
import { useRequest, useMutation } from "../../hooks/useRequest";
import { Card, CardContent } from "../common/Card";
import { EmptyState } from "../common/EmptyState";
import { Badge } from "../common/Badge";

interface Guest {
  id: number;
  name: string;
  age: number | null;
  gender: string | null;
  relationship: string | null;
  dietaryRestrictions: string | null;
  menuChoice: string;
  isChild: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface GuestDraft {
  name: string;
  age: string;
  gender: string;
  relationship: string;
  specialMenuType: string;
  allergyDetails: string;
  menuChoice: string;
  isChild: boolean;
  notes: string;
}

const MENU_OPTIONS = [
  "Victoria Plaza",
  "Menú infantil",
  "Menú especial",
];

const SPECIAL_MENU_OPTIONS = [
  "",
  "Vegetariano",
  "Vegano",
  "Celiaco",
  "Alergias",
  "Otro",
];

const GENDER_OPTIONS = [
  "",
  "Mujer",
  "Hombre",
  "No binario",
  "Prefiere no decir",
];

function guestToDraft(guest: Guest): GuestDraft {
  const rawDiet = (guest.dietaryRestrictions ?? "").trim();
  const parts = rawDiet ? rawDiet.split(":") : [];
  const specialMenuType = parts.length > 0 ? parts[0].trim() : "";
  const allergyDetails = parts.length > 1 ? parts.slice(1).join(":").trim() : "";

  const normalizedSpecialType = SPECIAL_MENU_OPTIONS.includes(specialMenuType)
    ? specialMenuType
    : rawDiet
      ? "Otro"
      : "";

  const normalizedDetails = normalizedSpecialType === "Otro" && !allergyDetails && rawDiet
    ? rawDiet
    : allergyDetails;

  return {
    name: guest.name,
    age: guest.age == null ? "" : String(guest.age),
    gender: guest.gender ?? "",
    relationship: guest.relationship ?? "",
    specialMenuType: normalizedSpecialType,
    allergyDetails: normalizedDetails,
    menuChoice: guest.menuChoice,
    isChild: guest.isChild === 1,
    notes: guest.notes ?? "",
  };
}

function parseAge(ageRaw: string): number | null {
  if (!ageRaw.trim()) return null;
  const age = Number(ageRaw);
  if (!Number.isFinite(age)) return null;
  return age;
}

function isChildMenuAllowed(ageRaw: string): boolean {
  const age = parseAge(ageRaw);
  return age == null || age <= 12;
}

function validateGuestDraft(draft: GuestDraft, t: (key: any) => string): string | null {
  if (!draft.name.trim()) return t("guests.validation.nameRequired");
  const age = parseAge(draft.age);
  if (draft.age.trim() && age === null) return t("guests.validation.ageInvalid");
  if (age != null && age < 0) return t("guests.validation.ageInvalid");

  if (draft.menuChoice === "Menú infantil") {
    if (age === null) return t("guests.validation.childMenuNeedsAge");
    if (age > 12) return t("guests.validation.childMenuMaxAge");
  }

  if (draft.menuChoice === "Menú especial" && !draft.specialMenuType) {
    return t("guests.validation.specialMenuRequired");
  }

  if (draft.specialMenuType === "Alergias" && !draft.allergyDetails.trim()) {
    return t("guests.validation.allergyDetailsRequired");
  }

  if (draft.specialMenuType === "Otro" && !draft.allergyDetails.trim()) {
    return t("guests.validation.specialDetailsRequired");
  }

  return null;
}

function buildDietaryRestrictions(draft: GuestDraft): string | null {
  if (draft.menuChoice !== "Menú especial" || !draft.specialMenuType) return null;
  if (draft.specialMenuType === "Alergias" || draft.specialMenuType === "Otro") {
    const details = draft.allergyDetails.trim();
    return details ? `${draft.specialMenuType}: ${details}` : draft.specialMenuType;
  }
  return draft.specialMenuType;
}

export function GuestsView() {
  const { t } = useI18n();
  const { data: guests, loading, refetch } = useRequest<Guest[]>("guests.list", undefined, { refreshOn: "guests" });
  const { mutate: createGuest, loading: creating } = useMutation<Partial<Guest>, Guest>("guests.create");
  const { mutate: updateGuest, loading: saving } = useMutation<Partial<Guest> & { id: number }, Guest>("guests.update");
  const { mutate: deleteGuest, loading: deleting } = useMutation<{ id: number }, { ok: boolean }>("guests.delete");

  const [drafts, setDrafts] = useState<Record<number, GuestDraft>>({});
  const [newGuest, setNewGuest] = useState<GuestDraft>({
    name: "",
    age: "",
    gender: "",
    relationship: "",
    specialMenuType: "",
    allergyDetails: "",
    menuChoice: "Victoria Plaza",
    isChild: false,
    notes: "",
  });
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!guests) return;
    const next: Record<number, GuestDraft> = {};
    for (const guest of guests) {
      next[guest.id] = guestToDraft(guest);
    }
    setDrafts(next);
  }, [guests]);

  const counts = useMemo(() => {
    const list = guests ?? [];
    const adults = list.filter((g) => g.isChild === 0).length;
    const children = list.filter((g) => g.isChild === 1).length;
    return { total: list.length, adults, children };
  }, [guests]);

  async function handleCreateGuest(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const validationError = validateGuestDraft(newGuest, t);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    const age = parseAge(newGuest.age);

    await createGuest({
      name: newGuest.name.trim(),
      age,
      gender: newGuest.gender || null,
      relationship: newGuest.relationship || null,
      dietaryRestrictions: buildDietaryRestrictions(newGuest),
      menuChoice: newGuest.menuChoice,
      isChild: age != null ? (age <= 12 ? 1 : 0) : (newGuest.isChild ? 1 : 0),
      notes: newGuest.notes || null,
    });

    setNewGuest({
      name: "",
      age: "",
      gender: "",
      relationship: "",
      specialMenuType: "",
      allergyDetails: "",
      menuChoice: "Victoria Plaza",
      isChild: false,
      notes: "",
    });
    refetch();
  }

  function updateDraft(id: number, patch: Partial<GuestDraft>) {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...patch },
    }));
  }

  function handleNewGuestAgeChange(age: string) {
    setNewGuest((prev) => {
      const ageVal = parseAge(age);
      const nextMenuChoice = ageVal != null && ageVal > 12 && prev.menuChoice === "Menú infantil"
        ? "Victoria Plaza"
        : prev.menuChoice;
      return {
        ...prev,
        age,
        menuChoice: nextMenuChoice,
      };
    });
  }

  function handleDraftAgeChange(id: number, age: string) {
    setDrafts((prev) => {
      const current = prev[id];
      if (!current) return prev;
      const ageVal = parseAge(age);
      const nextMenuChoice = ageVal != null && ageVal > 12 && current.menuChoice === "Menú infantil"
        ? "Victoria Plaza"
        : current.menuChoice;
      return {
        ...prev,
        [id]: {
          ...current,
          age,
          menuChoice: nextMenuChoice,
        },
      };
    });
  }

  async function handleSaveGuest(id: number) {
    const draft = drafts[id];
    if (!draft) return;
    const validationError = validateGuestDraft(draft, t);
    if (validationError) {
      alert(validationError);
      return;
    }

    const age = parseAge(draft.age);

    await updateGuest({
      id,
      name: draft.name.trim(),
      age,
      gender: draft.gender || null,
      relationship: draft.relationship || null,
      dietaryRestrictions: buildDietaryRestrictions(draft),
      menuChoice: draft.menuChoice,
      isChild: age != null ? (age <= 12 ? 1 : 0) : (draft.isChild ? 1 : 0),
      notes: draft.notes || null,
    });
  }

  async function handleDeleteGuest(id: number) {
    await deleteGuest({ id });
    refetch();
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-52 rounded bg-surface-elevated animate-pulse" />
        <div className="h-24 w-full rounded bg-surface-elevated animate-pulse" />
        <div className="h-72 w-full rounded bg-surface-elevated animate-pulse" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("guests.title")}</h1>
        <div className="flex items-center gap-2 text-xs text-on-surface-secondary">
          <Badge variant="default">{t("guests.count.total")}: {counts.total}</Badge>
          <Badge variant="default">{t("guests.count.adults")}: {counts.adults}</Badge>
          <Badge variant="default">{t("guests.count.children")}: {counts.children}</Badge>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-on-surface-secondary">{t("guests.menu.selected")}</span>
            <Badge variant="info">Victoria Plaza</Badge>
            <Badge variant="default">{t("guests.menu.vat")}</Badge>
          </div>
          <p className="text-sm text-on-surface-secondary">{t("guests.menu.summary")}</p>
          <div className="grid grid-cols-1 gap-2 text-sm text-on-surface-secondary sm:grid-cols-3">
            <div>{t("guests.menu.adultPrice")}</div>
            <div>{t("guests.menu.childPrice")}</div>
            <div>{t("guests.menu.special")}</div>
          </div>
          <p className="text-xs text-on-surface-tertiary">{t("guests.menu.under4")}</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <form onSubmit={handleCreateGuest} className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <input
              type="text"
              value={newGuest.name}
              onChange={(e) => setNewGuest((p) => ({ ...p, name: e.target.value }))}
              placeholder={t("guests.form.name")}
              className="rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-on-surface outline-none"
            />
            <input
              type="number"
              min={0}
              value={newGuest.age}
              onChange={(e) => handleNewGuestAgeChange(e.target.value)}
              placeholder={t("guests.form.age")}
              className="rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-on-surface outline-none"
            />
            <input
              type="text"
              value={newGuest.relationship}
              onChange={(e) => setNewGuest((p) => ({ ...p, relationship: e.target.value }))}
              placeholder={t("guests.form.relationship")}
              className="rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-on-surface outline-none"
            />
            <select
              value={newGuest.menuChoice}
              onChange={(e) => setNewGuest((p) => ({ ...p, menuChoice: e.target.value }))}
              className="rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-on-surface outline-none"
            >
              {MENU_OPTIONS.map((option) => {
                const disableChildOption = option === "Menú infantil" && !isChildMenuAllowed(newGuest.age);
                return (
                  <option key={option} value={option} disabled={disableChildOption}>{option}</option>
                );
              })}
            </select>
            <select
              value={newGuest.specialMenuType}
              onChange={(e) => setNewGuest((p) => ({ ...p, specialMenuType: e.target.value }))}
              disabled={newGuest.menuChoice !== "Menú especial"}
              className="rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-on-surface outline-none disabled:opacity-50"
            >
              <option value="">{t("guests.form.specialMenu")}</option>
              {SPECIAL_MENU_OPTIONS.filter(Boolean).map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            {(newGuest.menuChoice === "Menú especial" && (newGuest.specialMenuType === "Alergias" || newGuest.specialMenuType === "Otro")) && (
              <input
                type="text"
                value={newGuest.allergyDetails}
                onChange={(e) => setNewGuest((p) => ({ ...p, allergyDetails: e.target.value }))}
                placeholder={t("guests.form.specialDetails")}
                className="rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-on-surface outline-none md:col-span-2"
              />
            )}
            <label className="inline-flex items-center gap-2 text-sm text-on-surface-secondary">
              <input
                type="checkbox"
                checked={newGuest.isChild}
                onChange={(e) => setNewGuest((p) => ({ ...p, isChild: e.target.checked }))}
              />
              {t("guests.form.isChild")}
            </label>
            <button
              type="submit"
              disabled={creating}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              {t("guests.form.add")}
            </button>
            {formError && <p className="text-sm text-error md:col-span-4">{formError}</p>}
          </form>
        </CardContent>
      </Card>

      {!guests || guests.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t("guests.empty.title")}
          description={t("guests.empty.description")}
        />
      ) : (
        <div className="rounded-xl border border-border bg-surface-elevated overflow-hidden">
          <table className="w-full table-fixed text-sm">
            <thead>
              <tr className="border-b border-border text-on-surface-secondary">
                <th className="w-2/12 px-3 py-2 text-left">{t("guests.table.name")}</th>
                <th className="w-1/12 px-3 py-2 text-left">{t("guests.table.age")}</th>
                <th className="w-2/12 px-3 py-2 text-left">{t("guests.table.gender")}</th>
                <th className="w-2/12 px-3 py-2 text-left">{t("guests.table.relationship")}</th>
                <th className="w-2/12 px-3 py-2 text-left">{t("guests.table.diet")}</th>
                <th className="w-2/12 px-3 py-2 text-left">{t("guests.table.menu")}</th>
                <th className="w-1/12 px-3 py-2 text-right">{t("guests.table.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {guests.map((guest) => {
                const draft = drafts[guest.id];
                if (!draft) return null;
                return (
                  <tr key={guest.id} className="border-b border-border-subtle align-top">
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={draft.name}
                        onChange={(e) => updateDraft(guest.id, { name: e.target.value })}
                        className="w-full rounded border border-border bg-surface px-2 py-1"
                      />
                      {parseAge(draft.age) != null && parseAge(draft.age)! < 4 && (
                        <div className="mt-1">
                          <Badge variant="warning">{t("guests.badge.noPay")}</Badge>
                        </div>
                      )}
                      <div className="mt-1">
                        <label className="inline-flex items-center gap-1 text-xs text-on-surface-tertiary">
                          <input
                            type="checkbox"
                            checked={draft.isChild}
                            onChange={(e) => updateDraft(guest.id, { isChild: e.target.checked })}
                          />
                          {t("guests.form.isChild")}
                        </label>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        value={draft.age}
                        onChange={(e) => handleDraftAgeChange(guest.id, e.target.value)}
                        className="w-full rounded border border-border bg-surface px-2 py-1"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={draft.gender}
                        onChange={(e) => updateDraft(guest.id, { gender: e.target.value })}
                        className="w-full rounded border border-border bg-surface px-2 py-1"
                      >
                        {GENDER_OPTIONS.map((option) => (
                          <option key={option} value={option}>{option || t("guests.gender.unknown")}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={draft.relationship}
                        onChange={(e) => updateDraft(guest.id, { relationship: e.target.value })}
                        className="w-full rounded border border-border bg-surface px-2 py-1"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={draft.specialMenuType}
                        onChange={(e) => updateDraft(guest.id, { specialMenuType: e.target.value })}
                        disabled={draft.menuChoice !== "Menú especial"}
                        className="w-full rounded border border-border bg-surface px-2 py-1 disabled:opacity-50"
                      >
                        <option value="">{t("guests.form.specialMenu")}</option>
                        {SPECIAL_MENU_OPTIONS.filter(Boolean).map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                      {(draft.menuChoice === "Menú especial" && (draft.specialMenuType === "Alergias" || draft.specialMenuType === "Otro")) && (
                        <input
                          type="text"
                          value={draft.allergyDetails}
                          onChange={(e) => updateDraft(guest.id, { allergyDetails: e.target.value })}
                          placeholder={t("guests.form.specialDetails")}
                          className="mt-1 w-full rounded border border-border bg-surface px-2 py-1"
                        />
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={draft.menuChoice}
                        onChange={(e) => updateDraft(guest.id, { menuChoice: e.target.value })}
                        className="w-full rounded border border-border bg-surface px-2 py-1"
                      >
                        {MENU_OPTIONS.map((option) => {
                          const disableChildOption = option === "Menú infantil" && !isChildMenuAllowed(draft.age);
                          return (
                            <option key={option} value={option} disabled={disableChildOption}>{option}</option>
                          );
                        })}
                      </select>
                      {draft.menuChoice === "Menú especial" && (
                        <p className="mt-1 text-xs text-on-surface-tertiary">{t("guests.menu.specialHint")}</p>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleSaveGuest(guest.id)}
                          disabled={saving}
                          className="rounded p-1.5 text-on-surface-secondary hover:bg-surface-hover"
                          title={t("guests.actions.save")}
                        >
                          <Save className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteGuest(guest.id)}
                          disabled={deleting}
                          className="rounded p-1.5 text-on-surface-secondary hover:bg-red-500/10 hover:text-red-400"
                          title={t("guests.actions.delete")}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
