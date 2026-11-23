import { beforeEach, describe, expect, it, vi } from "vitest";
import { focusDialog } from "./focus-dialog";

/**
 * Tes aksi fokus dialog.
 *
 * Lingkungan tes proyek ini `node` (tanpa jsdom), jadi DOM tiruan minimal
 * dibuat di sini. Yang diuji HANYA perilaku yang menjadi alasan aksi ini ada:
 * fokus pindah ke dalam dialog, Tab berputar di dalam, dan fokus kembali ke
 * pemicu saat dialog ditutup. Kalau salah satunya rusak, `aria-modal` di tiga
 * dialog portal pelanggan kembali berbohong.
 */

interface FakeEl {
  tag: string;
  attrs: Record<string, string>;
  children: FakeEl[];
  parent: FakeEl | null;
  focused: boolean;
  offsetParent: unknown;
  hasAttribute: (n: string) => boolean;
  setAttribute: (n: string, v: string) => void;
  focus: () => void;
  querySelectorAll: (sel: string) => FakeEl[];
  contains: (el: FakeEl | null) => boolean;
  addEventListener: (t: string, fn: (e: unknown) => void) => void;
  removeEventListener: (t: string, fn: (e: unknown) => void) => void;
  isConnected: boolean;
  _listeners?: Record<string, ((e: unknown) => void)[]>;
}

function buatEl(tag: string, attrs: Record<string, string> = {}): FakeEl {
  const el: FakeEl = {
    tag,
    attrs: { ...attrs },
    children: [],
    parent: null,
    focused: false,
    offsetParent: {},
    isConnected: true,
    hasAttribute: (n) => n in el.attrs,
    setAttribute: (n, v) => {
      el.attrs[n] = v;
    },
    focus: () => {
      if (docElemenAktif) docElemenAktif.focused = false;
      el.focused = true;
      docElemenAktif = el;
    },
    querySelectorAll: (sel) => {
      const hasil: FakeEl[] = [];
      const cocok = (e: FakeEl): boolean => {
        if (sel.includes("button") && e.tag === "button") return true;
        if (sel.includes("a[href]") && e.tag === "a" && "href" in e.attrs) return true;
        if (sel.includes("[tabindex]") && "tabindex" in e.attrs) return true;
        return false;
      };
      const jalan = (e: FakeEl): void => {
        for (const c of e.children) {
          if (cocok(c)) hasil.push(c);
          jalan(c);
        }
      };
      jalan(el);
      return hasil;
    },
    contains: (target) => {
      if (!target) return false;
      if (target === el) return true;
      return el.children.some((c) => c.contains(target));
    },
    addEventListener: (t, fn) => {
      el._listeners ??= {};
      const daftar = el._listeners[t] ?? [];
      daftar.push(fn);
      el._listeners[t] = daftar;
    },
    removeEventListener: (t, fn) => {
      const arr = el._listeners?.[t] ?? [];
      const i = arr.indexOf(fn);
      if (i >= 0) arr.splice(i, 1);
    },
  };
  return el;
}

let docElemenAktif: FakeEl | null = null;

/**
 * DOM tiruan bukan HTMLElement sungguhan. Cast di satu tempat ini (bukan di
 * setiap pemanggilan) supaya niatnya jelas: yang diuji adalah logika fokus,
 * bukan kecocokan tipe DOM.
 */
function sebagaiElemen(el: FakeEl): HTMLElement {
  return el as unknown as HTMLElement;
}

beforeEach(() => {
  docElemenAktif = null;
  // Stub global yang dipakai aksi.
  vi.stubGlobal("document", {
    get activeElement() {
      return docElemenAktif;
    },
  });
  vi.stubGlobal("requestAnimationFrame", (fn: () => void) => {
    fn(); // jalankan segera: tes tidak perlu mensimulasikan bingkai
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {});
});

function tekanTab(el: FakeEl, shift = false): { prevented: boolean } {
  const listeners = el._listeners?.keydown ?? [];
  const event = {
    key: "Tab",
    shiftKey: shift,
    prevented: false,
    preventDefault() {
      this.prevented = true;
    },
  };
  for (const fn of listeners) fn(event);
  return { prevented: event.prevented };
}

describe("focusDialog", () => {
  it("memindahkan fokus ke tombol pertama di dalam dialog", () => {
    const pemicu = buatEl("button");
    pemicu.focus();
    expect(docElemenAktif).toBe(pemicu);

    const dialog = buatEl("div", { tabindex: "-1" });
    const tutup = buatEl("button");
    dialog.children.push(tutup);

    focusDialog(sebagaiElemen(dialog));
    expect(docElemenAktif).toBe(tutup);
  });

  it("memfokuskan dialognya sendiri bila tidak ada isi yang bisa difokus", () => {
    const dialog = buatEl("div");
    focusDialog(sebagaiElemen(dialog));
    expect(docElemenAktif).toBe(dialog);
    // tabindex -1 ditambahkan agar dialog bisa menerima fokus.
    expect(dialog.attrs.tabindex).toBe("-1");
  });

  it("Tab dari elemen terakhir berputar ke elemen pertama", () => {
    const dialog = buatEl("div", { tabindex: "-1" });
    const a = buatEl("button");
    const b = buatEl("button");
    dialog.children.push(a, b);

    focusDialog(sebagaiElemen(dialog));
    expect(docElemenAktif).toBe(a);
    b.focus();
    const { prevented } = tekanTab(dialog, false);
    expect(prevented).toBe(true);
    expect(docElemenAktif).toBe(a);
  });

  it("Shift+Tab dari elemen pertama berputar ke elemen terakhir", () => {
    const dialog = buatEl("div", { tabindex: "-1" });
    const a = buatEl("button");
    const b = buatEl("button");
    dialog.children.push(a, b);

    focusDialog(sebagaiElemen(dialog));
    expect(docElemenAktif).toBe(a);
    const { prevented } = tekanTab(dialog, true);
    expect(prevented).toBe(true);
    expect(docElemenAktif).toBe(b);
  });

  it("Tab menarik fokus kembali bila sempat keluar dari dialog", () => {
    const dialog = buatEl("div", { tabindex: "-1" });
    const a = buatEl("button");
    dialog.children.push(a);
    focusDialog(sebagaiElemen(dialog));

    const luar = buatEl("button"); // elemen di belakang dialog
    luar.focus();
    expect(docElemenAktif).toBe(luar);

    const { prevented } = tekanTab(dialog, false);
    expect(prevented).toBe(true);
    expect(docElemenAktif).toBe(a);
  });

  it("mengembalikan fokus ke pemicu saat dialog ditutup", () => {
    const pemicu = buatEl("button");
    pemicu.focus();
    const dialog = buatEl("div", { tabindex: "-1" });
    dialog.children.push(buatEl("button"));

    const aksi = focusDialog(sebagaiElemen(dialog));
    expect(docElemenAktif).not.toBe(pemicu);

    aksi.destroy();
    expect(docElemenAktif).toBe(pemicu);
  });

  it("tidak memindahkan fokus bila pemicu sudah lepas dari dokumen", () => {
    const pemicu = buatEl("button");
    pemicu.focus();
    const dialog = buatEl("div", { tabindex: "-1" });
    dialog.children.push(buatEl("button"));

    const aksi = focusDialog(sebagaiElemen(dialog));
    pemicu.isConnected = false;
    docElemenAktif = null;
    aksi.destroy();
    // Tidak ada fokus nyasar ke elemen yang sudah tidak ada.
    expect(docElemenAktif).toBeNull();
  });
});
