import { departments, paymentKinds } from "@eyeflow/shared";
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@eyeflow/ui";
import { useForm } from "@tanstack/react-form";
import { Banknote, Check, CreditCard, IndianRupee, Smartphone } from "lucide-react";
import { type ReactNode, useState } from "react";
import {
  type CollectionFormValues,
  collectionSchema,
  creditProviders,
  type NewCollection,
  onlineModes,
  paymentModeLabels,
  toNewCollection,
} from "./collection-schema";

interface AddCollectionDialogProps {
  onAdd: (collection: NewCollection) => Promise<void>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const modeIcons = { cash: Banknote, credit: CreditCard, online: Smartphone } as const;

const defaultValues: CollectionFormValues = {
  amount: "",
  department: "OPD",
  discount: "0",
  mode: "cash",
  patient: "",
  providerOrMode: "",
};

const fieldError = (errors: unknown[]): string | undefined => {
  const error = errors[0];
  if (typeof error === "string") return error;
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return undefined;
};

export function AddCollectionDialog({ onAdd, onOpenChange, open }: AddCollectionDialogProps) {
  const [saved, setSaved] = useState(false);
  const [submitError, setSubmitError] = useState<string>();
  const form = useForm({
    defaultValues,
    validators: { onSubmit: collectionSchema },
    onSubmit: async ({ value }) => {
      try {
        setSubmitError(undefined);
        const parsed = collectionSchema.parse(value);
        await onAdd(toNewCollection(parsed));
        setSaved(true);
        window.setTimeout(() => {
          setSaved(false);
          onOpenChange(false);
          form.reset();
        }, 650);
      } catch (error) {
        setSubmitError(
          error instanceof Error
            ? error.message
            : "Unable to save this collection. Please try again.",
        );
      }
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) form.reset();
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add collection</DialogTitle>
          <DialogDescription>Record a payment against a patient and department.</DialogDescription>
        </DialogHeader>

        <form
          className="space-y-6 p-6"
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void form.handleSubmit();
          }}
        >
          <form.Field name="patient">
            {(field) => (
              <FormField
                error={fieldError(field.state.meta.errors)}
                htmlFor={field.name}
                label="Patient name"
                required
              >
                <input
                  aria-invalid={field.state.meta.errors.length > 0}
                  autoComplete="off"
                  autoFocus
                  className="form-control"
                  id={field.name}
                  maxLength={120}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="e.g. Anita Rao"
                  value={field.state.value}
                />
              </FormField>
            )}
          </form.Field>

          <form.Field name="department">
            {(field) => (
              <fieldset>
                <legend className="form-label">Department</legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {departments.map((department) => (
                    <button
                      aria-pressed={field.state.value === department}
                      className="choice-button"
                      data-selected={field.state.value === department}
                      key={department}
                      onClick={() => field.handleChange(department)}
                      type="button"
                    >
                      {department}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}
          </form.Field>

          <form.Field name="mode">
            {(field) => (
              <fieldset>
                <legend className="form-label">Payment mode</legend>
                <div className="grid grid-cols-3 gap-2">
                  {paymentKinds.map((mode) => {
                    const Icon = modeIcons[mode];
                    return (
                      <button
                        aria-pressed={field.state.value === mode}
                        className="choice-button justify-center"
                        data-selected={field.state.value === mode}
                        key={mode}
                        onClick={() => {
                          field.handleChange(mode);
                          form.setFieldValue("providerOrMode", "");
                        }}
                        type="button"
                      >
                        <Icon aria-hidden="true" size={16} />
                        {paymentModeLabels[mode]}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            )}
          </form.Field>

          <form.Subscribe selector={(state) => state.values.mode}>
            {(mode) =>
              mode === "cash" ? null : (
                <form.Field name="providerOrMode">
                  {(field) => (
                    <FormField
                      error={fieldError(field.state.meta.errors)}
                      htmlFor={field.name}
                      label={mode === "credit" ? "Insurance / provider" : "Online payment mode"}
                      required
                    >
                      <select
                        aria-invalid={field.state.meta.errors.length > 0}
                        className="form-control"
                        id={field.name}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                        value={field.state.value}
                      >
                        <option value="">Select an option</option>
                        {(mode === "credit" ? creditProviders : onlineModes).map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </FormField>
                  )}
                </form.Field>
              )
            }
          </form.Subscribe>

          <div className="grid gap-4 sm:grid-cols-2">
            <form.Field name="amount">
              {(field) => (
                <FormField
                  error={fieldError(field.state.meta.errors)}
                  htmlFor={field.name}
                  label="Amount"
                  required
                >
                  <MoneyInput field={field} />
                </FormField>
              )}
            </form.Field>
            <form.Field name="discount">
              {(field) => (
                <FormField
                  error={fieldError(field.state.meta.errors)}
                  htmlFor={field.name}
                  label="Discount"
                >
                  <MoneyInput field={field} />
                </FormField>
              )}
            </form.Field>
          </div>

          <form.Subscribe
            selector={(state) => [state.values.amount, state.values.discount] as const}
          >
            {([amount, discount]) => {
              const finalAmount = Math.max(0, Number(amount || 0) - Number(discount || 0));
              return (
                <div className="flex items-center justify-between rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.07] px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold">Final amount</p>
                    <p className="text-xs text-[var(--muted-strong)]">Amount minus discount</p>
                  </div>
                  <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                    ₹{finalAmount.toLocaleString("en-IN")}
                  </p>
                </div>
              );
            }}
          </form.Subscribe>

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
            <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting] as const}>
              {([canSubmit, isSubmitting]) => (
                <Button disabled={!canSubmit || isSubmitting || saved} type="submit">
                  {saved ? (
                    <>
                      <Check size={17} />
                      Collection added
                    </>
                  ) : isSubmitting ? (
                    "Saving…"
                  ) : (
                    "Add transaction"
                  )}
                </Button>
              )}
            </form.Subscribe>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface FormFieldProps {
  children: ReactNode;
  error?: string | undefined;
  htmlFor: string;
  label: string;
  required?: boolean;
}

function FormField({ children, error, htmlFor, label, required = false }: FormFieldProps) {
  return (
    <div>
      <label className="form-label" htmlFor={htmlFor}>
        {label}
        {required ? <span className="ml-1 text-rose-500">*</span> : null}
      </label>
      {children}
      {error ? (
        <p className="mt-1.5 text-xs font-medium text-rose-500" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

interface MoneyInputProps {
  field: {
    handleBlur: () => void;
    handleChange: (value: string) => void;
    name: string;
    state: { meta: { errors: unknown[] }; value: string };
  };
}

function MoneyInput({ field }: MoneyInputProps) {
  return (
    <div className="relative">
      <IndianRupee
        aria-hidden="true"
        className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
        size={16}
      />
      <input
        aria-invalid={field.state.meta.errors.length > 0}
        className="form-control pl-9"
        id={field.name}
        inputMode="decimal"
        min="0"
        onBlur={field.handleBlur}
        onChange={(event) => field.handleChange(event.target.value)}
        placeholder="0"
        step="0.01"
        type="number"
        value={field.state.value}
      />
    </div>
  );
}
