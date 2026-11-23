// Umpan balik aksi admin: tombol menampilkan spinner kecil saat diproses,
// notifikasi singkat di TENGAH layar saat berhasil, dan notifikasi galat yang
// sama-sama di tengah saat gagal.
//
// Kenapa notifikasi di tengah: kotak galat bawaan form berada di bagian atas
// halaman, sedangkan tombol aksi utama (status pesanan) ada di bilah bawah —
// admin tidak pernah melihat pesannya dan mengira tombolnya tidak bekerja.
// Notifikasi dipasang `position: fixed` di tengah agar terlihat dari posisi
// gulir mana pun.
//
// Ketahanan: sebelumnya penanda `is-busy` (CSS: pointer-events none) hanya
// dilepas pada jalur sukses. Satu kegagalan jaringan membuat form MATI
// permanen sampai halaman dimuat ulang. Semua jalur sekarang memakai
// try/finally supaya tombol selalu bisa diklik lagi.
//
// Kecepatan: bawaan SvelteKit mengambil ulang SELURUH data halaman sesudah
// aksi sukses. Untuk halaman yang aksinya sudah mengembalikan keadaan terbaru
// (lihat `freshOrder` di halaman pesanan), refresh penuh itu tidak perlu —
// berikan opsi `local` untuk memakai hasil aksi secara langsung.
//
// Isian form TIDAK dikosongkan setelah simpan (reset bawaan SvelteKit membuat
// field yang tidak diubah jadi kosong); form tambah data baru meminta
// reset: true agar bersih untuk isian berikutnya.

export interface ToastDetail {
  message: string;
  tone?: "ok" | "error";
}

export interface AdminEnhanceOptions<T = unknown> {
  reset?: boolean;
  /**
   * Bila diisi, hasil aksi sukses dipakai langsung (tanpa muat ulang seluruh
   * data halaman). Callback menerima `result.data` dari aksi.
   */
  local?: (data: T) => void;
}

function notify(message: string, tone: "ok" | "error"): void {
  window.dispatchEvent(new CustomEvent<ToastDetail>("kurma:toast", { detail: { message, tone } }));
}

// Aksi admin mengembalikan `fail(400, { message })`; ambil teksnya agar pesan
// yang spesifik sampai ke admin, bukan kalimat umum.
function failureText(data: unknown): string | null {
  if (typeof data !== "object" || data === null) return null;
  const message = (data as { message?: unknown }).message;
  return typeof message === "string" && message.trim() !== "" ? message : null;
}

// Kotak galat di dalam halaman tetap dipertahankan, tetapi digulirkan ke
// pandangan supaya tidak terlewat (posisinya di atas halaman).
function revealErrorBox(): void {
  requestAnimationFrame(() => {
    const box = document.querySelector(".error-box");
    box?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

export function adminEnhance<T = unknown>(
  message = "Perubahan tersimpan.",
  options: AdminEnhanceOptions<T> = {},
) {
  return ({
    formElement,
    submitter,
    cancel,
  }: {
    action: URL;
    formData: FormData;
    formElement: HTMLFormElement;
    controller: AbortController;
    submitter: HTMLElement | null;
    cancel: () => void;
  }) => {
    if (formElement.classList.contains("is-busy")) {
      cancel();
      return;
    }
    formElement.classList.add("is-busy");
    const button = submitter instanceof HTMLElement ? submitter : null;
    button?.classList.add("is-busy");
    return async ({
      result,
      update,
    }: {
      formData: FormData;
      formElement: HTMLFormElement;
      action: URL;
      result: { type: string; data?: unknown };
      update: (options?: {
        reset?: boolean;
        refreshAll?: boolean;
        navigate?: boolean;
        invalidateAll?: boolean;
      }) => Promise<void>;
    }) => {
      try {
        if (result.type === "success" && options.local) {
          // Langsung pakai hasil aksi: tidak ada muat ulang data halaman.
          await update({ reset: options.reset ?? false, refreshAll: false });
          options.local(result.data as T);
        } else {
          // `refreshAll` bawaan hanya untuk sukses. Hasil gagal pun butuh data
          // segar (mis. status sebenarnya sesudah aksi ditolak) tanpa memicu
          // navigasi ulang.
          await update({
            reset: options.reset ?? false,
            refreshAll: result.type !== "redirect",
          });
        }
        if (result.type === "success") {
          notify(message, "ok");
        } else if (result.type === "failure") {
          // Pesan asli dari server (mis. "Perpindahan paid → packed tidak
          // sah.") ditampilkan di tengah layar — kotak galat bawaan form ada
          // di atas halaman dan tidak terlihat saat admin menekan tombol di
          // bilah bawah.
          notify(failureText(result.data) ?? "Perubahan ditolak.", "error");
          revealErrorBox();
        } else if (result.type === "error") {
          notify("Terjadi gangguan saat menghubungi server. Coba lagi.", "error");
        }
      } catch {
        notify("Gagal menyimpan. Periksa koneksi lalu coba lagi.", "error");
      } finally {
        // Selalu dilepas — apa pun hasilnya — supaya form tidak pernah macet.
        formElement.classList.remove("is-busy");
        button?.classList.remove("is-busy");
      }
    };
  };
}
