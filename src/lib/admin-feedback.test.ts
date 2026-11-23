// Tes umpan balik aksi admin (src/lib/admin-feedback.ts).
//
// Regresi yang dijaga:
// 1. Form TIDAK boleh macet setelah kegagalan. Sebelumnya penanda `is-busy`
//    (CSS: pointer-events none) hanya dilepas pada jalur sukses, sehingga satu
//    kegagalan jaringan membuat form mati sampai halaman dimuat ulang.
// 2. Setiap hasil harus menghasilkan notifikasi yang terlihat admin — bukan
//    hanya kotak galat di atas halaman yang tidak terlihat dari bilah bawah.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { adminEnhance } from "./admin-feedback";

class FakeClassList {
  private set = new Set<string>();
  add(...names: string[]): void {
    for (const name of names) this.set.add(name);
  }
  remove(...names: string[]): void {
    for (const name of names) this.set.delete(name);
  }
  contains(name: string): boolean {
    return this.set.has(name);
  }
}

function fakeForm(): {
  form: { classList: FakeClassList };
  button: FakeHTMLElement;
} {
  return { form: { classList: new FakeClassList() }, button: new FakeHTMLElement() };
}

interface ToastCall {
  message: string;
  tone: "ok" | "error";
}

let toasts: ToastCall[] = [];

// Kelas tiruan agar `submitter instanceof HTMLElement` bisa diuji tanpa DOM.
class FakeHTMLElement {
  classList = new FakeClassList();
}

beforeEach(() => {
  toasts = [];
  vi.stubGlobal("HTMLElement", FakeHTMLElement);
  // Ganti window dengan tiruan minimal: hanya dispatchEvent yang dipakai.
  vi.stubGlobal("window", {
    dispatchEvent(event: { detail: ToastCall }) {
      toasts.push(event.detail);
      return true;
    },
  });
  vi.stubGlobal("requestAnimationFrame", (cb: () => void) => {
    cb();
    return 1;
  });
  vi.stubGlobal("document", { querySelector: () => null });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Bangun fungsi submit hasil `adminEnhance` dengan form & tombol tiruan. */
function setup(options?: { reset?: boolean }) {
  const { form, button } = fakeForm();
  const cancel = vi.fn();
  const submit = adminEnhance(
    "Perubahan tersimpan.",
    options,
  )({
    action: new URL("http://localhost/admin"),
    formData: new FormData(),
    formElement: form as unknown as HTMLFormElement,
    controller: new AbortController(),
    submitter: button as unknown as HTMLElement,
    cancel,
  });
  if (typeof submit !== "function") throw new Error("enhance tidak mengembalikan callback");
  return { submit, form, button, cancel };
}

type UpdateFn = (options?: {
  reset?: boolean;
  refreshAll?: boolean;
  navigate?: boolean;
  invalidateAll?: boolean;
}) => Promise<void>;

function call(
  submit: ReturnType<typeof setup>["submit"],
  result: { type: string; data?: unknown },
  update: UpdateFn,
) {
  return submit({
    formData: new FormData(),
    formElement: {} as HTMLFormElement,
    action: new URL("http://localhost/admin"),
    result,
    update,
  } as never);
}

describe("adminEnhance: form tidak pernah macet", () => {
  it("melepas is-busy setelah sukses dan memberi toast sukses", async () => {
    const { submit, form, button } = setup();
    const update = vi.fn<UpdateFn>(async () => {});
    await call(submit, { type: "success" }, update);
    expect(form.classList.contains("is-busy")).toBe(false);
    expect(button.classList.contains("is-busy")).toBe(false);
    expect(toasts).toEqual([{ message: "Perubahan tersimpan.", tone: "ok" }]);
  });

  it("melepas is-busy setelah gagal (failure) — regresi utama", async () => {
    const { submit, form, button } = setup();
    const update = vi.fn<UpdateFn>(async () => {});
    await call(
      submit,
      { type: "failure", data: { message: "Perpindahan paid → packed tidak sah." } },
      update,
    );
    expect(form.classList.contains("is-busy")).toBe(false);
    expect(button.classList.contains("is-busy")).toBe(false);
  });

  it("melepas is-busy ketika update() melempar galat jaringan — regresi utama", async () => {
    const { submit, form, button } = setup();
    const update = vi.fn<UpdateFn>(async () => {
      throw new TypeError("Failed to fetch");
    });
    await call(submit, { type: "success" }, update);
    expect(form.classList.contains("is-busy")).toBe(false);
    expect(button.classList.contains("is-busy")).toBe(false);
    expect(toasts[0]?.tone).toBe("error");
  });

  it("melepas is-busy ketika callback SvelteKit membuang (reject) hasil aksi", async () => {
    const { submit, form } = setup();
    // Jalur nyata: `update()` menunggu applyAction; galat lempar keluar.
    const update = vi.fn<UpdateFn>(async () => {
      throw new Error("boom");
    });
    await expect(call(submit, { type: "error" }, update)).resolves.toBeUndefined();
    expect(form.classList.contains("is-busy")).toBe(false);
  });
});

describe("adminEnhance: pesan sampai ke admin", () => {
  it("memakai pesan asli dari server pada failure", async () => {
    const { submit } = setup();
    await call(
      submit,
      { type: "failure", data: { message: "Isi nominal ongkir sebelum mengonfirmasi." } },
      async () => {},
    );
    expect(toasts).toEqual([
      { message: "Isi nominal ongkir sebelum mengonfirmasi.", tone: "error" },
    ]);
  });

  it("memakai kalimat umum bila failure tanpa pesan", async () => {
    const { submit } = setup();
    await call(submit, { type: "failure", data: {} }, async () => {});
    expect(toasts).toEqual([{ message: "Perubahan ditolak.", tone: "error" }]);
  });

  it("memberi tahu admin saat ada gangguan server (type error)", async () => {
    const { submit } = setup();
    await call(submit, { type: "error" }, async () => {});
    expect(toasts[0]?.tone).toBe("error");
    expect(toasts[0]?.message).toContain("gangguan");
  });

  it("meminta data segar juga saat gagal, tanpa navigasi ulang", async () => {
    const { submit } = setup();
    const update = vi.fn<UpdateFn>(async () => {});
    await call(submit, { type: "failure", data: { message: "ditolak" } }, update);
    expect(update).toHaveBeenCalledWith({ reset: false, refreshAll: true });
  });

  it("menghormati reset:true untuk form tambah data", async () => {
    const { submit } = setup({ reset: true });
    const update = vi.fn<UpdateFn>(async () => {});
    await call(submit, { type: "success" }, update);
    expect(update).toHaveBeenCalledWith({ reset: true, refreshAll: true });
  });

  it("opsi local: pakai hasil aksi tanpa muat ulang seluruh data", async () => {
    const { form, button } = fakeForm();
    const seen: unknown[] = [];
    const submit = adminEnhance<{ order?: { code: string } }>("Tersimpan.", {
      local: (data) => seen.push(data),
    })({
      action: new URL("http://localhost/admin"),
      formData: new FormData(),
      formElement: form as unknown as HTMLFormElement,
      controller: new AbortController(),
      submitter: button as unknown as HTMLElement,
      cancel: vi.fn(),
    });
    const update = vi.fn<UpdateFn>(async () => {});
    await call(submit as never, { type: "success", data: { order: { code: "ABC" } } }, update);
    // refreshAll WAJIB false: data halaman tidak diambil ulang.
    expect(update).toHaveBeenCalledWith({ reset: false, refreshAll: false });
    expect(seen).toEqual([{ order: { code: "ABC" } }]);
    expect(toasts).toEqual([{ message: "Tersimpan.", tone: "ok" }]);
  });

  it("opsi local tidak dipakai saat gagal (tetap ambil data segar)", async () => {
    const { form, button } = fakeForm();
    const seen: unknown[] = [];
    const submit = adminEnhance<{ order?: unknown }>("Tersimpan.", {
      local: (data) => seen.push(data),
    })({
      action: new URL("http://localhost/admin"),
      formData: new FormData(),
      formElement: form as unknown as HTMLFormElement,
      controller: new AbortController(),
      submitter: button as unknown as HTMLElement,
      cancel: vi.fn(),
    });
    const update = vi.fn<UpdateFn>(async () => {});
    await call(submit as never, { type: "failure", data: { message: "ditolak" } }, update);
    expect(update).toHaveBeenCalledWith({ reset: false, refreshAll: true });
    expect(seen).toEqual([]);
  });

  it("membatalkan kiriman ganda saat form masih sibuk", () => {
    const { form } = fakeForm();
    form.classList.add("is-busy");
    const cancel = vi.fn();
    adminEnhance()({
      action: new URL("http://localhost/admin"),
      formData: new FormData(),
      formElement: form as unknown as HTMLFormElement,
      controller: new AbortController(),
      submitter: null,
      cancel,
    });
    expect(cancel).toHaveBeenCalled();
  });
});
