// Umpan balik aksi admin: tombol menampilkan spinner kecil saat diproses,
// toast singkat saat berhasil, dan kegagalan ditampilkan lewat kotak pesan
// form yang tetap terlihat di halaman.
// Isian form TIDAK dikosongkan setelah simpan (reset bawaan SvelteKit membuat
// field yang tidak diubah jadi kosong); form tambah data baru meminta
// reset: true agar bersih untuk isian berikutnya.
export function adminEnhance(message = "Perubahan tersimpan.", options: { reset?: boolean } = {}) {
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
      result: { type: string };
      update: (options?: {
        reset?: boolean;
        refreshAll?: boolean;
        navigate?: boolean;
        invalidateAll?: boolean;
      }) => Promise<void>;
    }) => {
      await update({ reset: options.reset ?? false });
      formElement.classList.remove("is-busy");
      button?.classList.remove("is-busy");
      if (result.type === "success") {
        window.dispatchEvent(new CustomEvent("kurma:toast", { detail: message }));
      }
    };
  };
}
