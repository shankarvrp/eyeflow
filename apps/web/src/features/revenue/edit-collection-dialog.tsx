import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@eyeflow/ui";
import { Check, IndianRupee } from "lucide-react";
import { useEffect, useState } from "react";
import type { RecentCollection } from "../dashboard/dashboard-data";
import { type EditCollection, editCollectionSchema } from "./collection-schema";

interface EditCollectionDialogProps {
  collection: RecentCollection | null;
  onOpenChange: (open: boolean) => void;
  onSave: (collection: EditCollection) => Promise<void>;
  open: boolean;
}

export function EditCollectionDialog({
  collection,
  onOpenChange,
  onSave,
  open,
}: EditCollectionDialogProps) {
  const [amount, setAmount] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [providerOrMode, setProviderOrMode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string>();

  useEffect(() => {
    if (!collection) return;
    setAmount(collection.amount + collection.discount);
    setDiscount(collection.discount);
    setProviderOrMode(collection.providerOrMode ?? "");
    setSubmitError(undefined);
  }, [collection]);

  const submit = async () => {
    if (!collection) return;
    const parsed = editCollectionSchema.safeParse({
      amount,
      discount,
      id: collection.id,
      providerOrMode: providerOrMode.trim() || null,
    });
    if (!parsed.success) {
      setSubmitError(parsed.error.issues[0]?.message ?? "Review the collection values.");
      return;
    }

    try {
      setSubmitting(true);
      setSubmitError(undefined);
      await onSave(parsed.data);
      onOpenChange(false);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to update this collection.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit collection</DialogTitle>
          <DialogDescription>
            {collection
              ? `${collection.patient} · ${collection.department} · ${collection.mode}`
              : "Update the selected payment."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-5 p-5 sm:p-6"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <MoneyField label="Gross amount" onChange={setAmount} value={amount} />
            <MoneyField label="Discount" onChange={setDiscount} value={discount} />
          </div>
          {collection?.mode !== "Cash" ? (
            <label>
              <span className="form-label">
                {collection?.mode === "Credit" ? "Insurance / provider" : "Payment mode"}
              </span>
              <input
                className="form-control"
                maxLength={120}
                onChange={(event) => setProviderOrMode(event.target.value)}
                value={providerOrMode}
              />
            </label>
          ) : null}
          <div className="rounded-xl bg-[var(--subtle-panel)] px-4 py-3">
            <p className="text-xs text-[var(--muted)]">Final amount</p>
            <p className="mt-1 text-xl font-bold">
              {formatCurrency(Math.max(0, amount - discount))}
            </p>
          </div>
          {submitError ? (
            <p
              className="rounded-xl border border-rose-500/20 bg-rose-500/[0.07] px-4 py-3 text-sm font-medium text-rose-600 dark:text-rose-300"
              role="alert"
            >
              {submitError}
            </p>
          ) : null}
          <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-5">
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </DialogClose>
            <Button disabled={submitting} type="submit">
              {submitting ? (
                "Saving…"
              ) : (
                <>
                  <Check size={17} />
                  Save changes
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MoneyField({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: number) => void;
  value: number;
}) {
  return (
    <label>
      <span className="form-label">{label}</span>
      <div className="relative">
        <IndianRupee
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
          size={15}
        />
        <input
          className="form-control pl-9"
          inputMode="decimal"
          min="0"
          onChange={(event) => onChange(Math.max(0, Number(event.target.value || 0)))}
          step="0.01"
          type="number"
          value={value}
        />
      </div>
    </label>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    currency: "INR",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}
