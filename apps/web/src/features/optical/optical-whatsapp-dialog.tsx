import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@eyeflow/ui";
import { CalendarClock, MessageCircle } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { setOpticalOrderContact } from "./optical.functions";
import type { OpticalOrder, OpticalTrackerData } from "./optical-schema";

type MessageKind = "overdue" | "ready";

interface OpticalWhatsAppDialogProps {
  kind: MessageKind;
  onOpenChange: (open: boolean) => void;
  onSaved: (tracker: OpticalTrackerData) => void;
  open: boolean;
  order: OpticalOrder;
}

export function OpticalWhatsAppDialog({
  kind,
  onOpenChange,
  onSaved,
  open,
  order,
}: OpticalWhatsAppDialogProps) {
  const [phone, setPhone] = useState(order.customerPhone ?? "");
  const [expectedDate, setExpectedDate] = useState(order.expectedDeliveryDate);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPhone(order.customerPhone ?? "");
    setExpectedDate(order.expectedDeliveryDate);
    setError(undefined);
  }, [open, order.customerPhone, order.expectedDeliveryDate]);

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const whatsappPhone = normalizeWhatsAppPhone(phone);
    if (!whatsappPhone) {
      setError("Enter a valid customer mobile number.");
      return;
    }
    if (kind === "overdue" && !expectedDate) {
      setError("Enter the revised expected delivery date.");
      return;
    }

    const whatsappWindow = window.open("about:blank", "_blank");
    try {
      setSaving(true);
      setError(undefined);
      const tracker = await setOpticalOrderContact({
        data: {
          customerPhone: phone,
          expectedDeliveryDate: kind === "overdue" ? expectedDate : undefined,
          orderKey: order.orderKey,
        },
      });
      onSaved(tracker);
      const message = buildMessage(kind, order.patient, expectedDate);
      const url = `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(message)}`;
      if (whatsappWindow) whatsappWindow.location.href = url;
      else window.open(url, "_blank", "noopener,noreferrer");
      onOpenChange(false);
    } catch (sendError) {
      whatsappWindow?.close();
      setError(sendError instanceof Error ? sendError.message : "Unable to open WhatsApp.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {kind === "overdue" ? "Update delayed order" : "Order ready message"}
          </DialogTitle>
          <DialogDescription>
            Confirm the details below. WhatsApp will open with the message ready for you to send.
          </DialogDescription>
        </DialogHeader>
        <form className="mt-5 space-y-4" onSubmit={sendMessage}>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--subtle-panel)] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
              Customer
            </p>
            <p className="mt-1 font-bold">{order.patient}</p>
          </div>
          <label className="block space-y-1.5">
            <span className="text-sm font-bold">WhatsApp number</span>
            <input
              autoFocus
              className="form-control w-full"
              inputMode="tel"
              onChange={(event) => setPhone(event.target.value)}
              placeholder="e.g. 98765 43210"
              required
              value={phone}
            />
            <span className="text-xs text-[var(--muted)]">
              Indian 10-digit numbers automatically use country code +91.
            </span>
          </label>
          {kind === "overdue" ? (
            <label className="block space-y-1.5">
              <span className="inline-flex items-center gap-2 text-sm font-bold">
                <CalendarClock size={16} /> Revised expected delivery
              </span>
              <input
                className="form-control w-full"
                min={todayDate()}
                onChange={(event) => setExpectedDate(event.target.value)}
                required
                type="date"
                value={expectedDate}
              />
            </label>
          ) : null}
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.07] p-4 text-sm leading-6">
            <p className="mb-1 text-xs font-bold uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-300">
              Message preview
            </p>
            {buildMessage(kind, order.patient, expectedDate)}
          </div>
          {error ? (
            <p className="text-sm font-semibold text-rose-600 dark:text-rose-300" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-3 pt-2">
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </DialogClose>
            <Button disabled={saving} type="submit">
              <MessageCircle size={16} /> {saving ? "Preparing…" : "Open WhatsApp"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function normalizeWhatsAppPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return digits;
  return null;
}

function buildMessage(kind: MessageKind, patient: string, expectedDate: string) {
  if (kind === "ready") {
    return `Dear ${patient}, your optical order is ready for collection. Please visit the clinic at your convenience to collect it. Thank you.`;
  }
  const date = expectedDate ? formatDate(expectedDate) : "the revised delivery date";
  return `Dear ${patient}, we sincerely apologize for the delay with your optical order. We now expect it to be ready by ${date}. Thank you for your patience and understanding.`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function todayDate() {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Kolkata",
    year: "numeric",
  }).format(new Date());
}
