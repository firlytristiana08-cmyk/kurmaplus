import { json, type RequestHandler } from "@sveltejs/kit";
import { getOrderByCode, getSettings, markPaidByInvoice, recordWebhookEvent } from "#lib/server/db";
import { loadDokuConfig, verifyNotificationSignature } from "#lib/server/doku";
import { notifyOwnerPaid } from "#lib/server/notify";

// Notifikasi DOKU (FR-12): signature diverifikasi dari isi mentah, event
// ganda hanya diproses sekali, balasan 200 segera.
export const POST: RequestHandler = async ({ request }) => {
  const config = loadDokuConfig(process.env);
  if (!config) {
    return json({ message: "Kunci DOKU belum diatur" }, { status: 503 });
  }

  const rawBody = await request.text();
  const clientId = request.headers.get("Client-Id") ?? "";
  const requestId = request.headers.get("Request-Id") ?? "";
  const requestTimestamp = request.headers.get("Request-Timestamp") ?? "";
  const signature = request.headers.get("Signature") ?? "";
  const requestTarget = new URL(request.url).pathname;

  const valid = await verifyNotificationSignature({
    config,
    clientId,
    requestId,
    requestTimestamp,
    requestTarget,
    rawBody,
    signature,
  });
  if (!valid) {
    return json({ message: "Signature tidak sah" }, { status: 401 });
  }

  const now = new Date();
  const isNewEvent = await recordWebhookEvent(requestId, now);
  if (!isNewEvent) {
    return json({ message: "Notifikasi sudah diproses" });
  }

  let payload: { transaction?: { status?: string }; order?: { invoice_number?: string } };
  try {
    payload = JSON.parse(rawBody) as typeof payload;
  } catch {
    return json({ message: "Isi notifikasi tidak sah" }, { status: 400 });
  }

  // Hanya status SUCCESS yang mengubah pesanan; FAILED diabaikan karena
  // pembeli boleh mengganti metode bayar di Checkout.
  if (payload.transaction?.status === "SUCCESS" && payload.order?.invoice_number) {
    const paid = await markPaidByInvoice(payload.order.invoice_number, now);
    if (paid) {
      // AD-23: beri tahu pemilik setelah 200 — kegagalan kirim tidak boleh
      // menggagalkan pemrosesan pembayaran, dan tanpa data pribadi.
      const code = payload.order.invoice_number;
      Promise.all([getOrderByCode(code), getSettings()])
        .then(([order, settings]) => {
          if (!order) return false;
          return notifyOwnerPaid(
            {
              code,
              itemCount: order.items.reduce((n, item) => n + item.qty, 0),
              deliveryDate: order.deliveryDate,
            },
            settings.notify_chat_id ?? "",
            process.env.TELEGRAM_BOT_TOKEN,
          );
        })
        .catch(() => false);
    }
  }

  return json({ message: "OK" });
};
