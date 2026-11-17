// Pemberitahuan ke pemilik saat pesanan dibayar (PRD Portal Admin — AD-23):
// bot Telegram dari sisi server, satu panggilan HTTP, tanpa library.
// Isi pesan TANPA data pribadi (hanya kode, jumlah item, tanggal kirim).
// Kegagalan kirim tidak boleh menggagalkan pemrosesan pembayaran.

export interface NotifyPayload {
  code: string;
  itemCount: number;
  deliveryDate: string;
}

export async function notifyOwnerPaid(
  payload: NotifyPayload,
  chatId: string,
  botToken: string | undefined,
): Promise<boolean> {
  if (!botToken || chatId.trim() === "") return false;
  try {
    const text =
      `KURMAPLUS: pesanan ${payload.code} sudah dibayar.\n` +
      `${payload.itemCount} item · dikirim ${payload.deliveryDate}`;
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
