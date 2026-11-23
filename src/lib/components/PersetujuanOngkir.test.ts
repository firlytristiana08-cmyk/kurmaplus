import { readFileSync } from "node:fs";
import { compile } from "svelte/compiler";
import { describe, expect, it } from "vitest";

/**
 * Tes kontrak dialog persetujuan ongkir.
 *
 * Kenapa tes ini ada: dialog ini menjaga uang pembeli. Ongkir Grab/Gojek
 * dibayar ke kurir, bukan termasuk total di halaman bayar. Kalau tombol
 * "Belum, kembali" ternyata membuka checkout, atau Escape ikut melanjutkan,
 * pembeli bisa terlanjur memesan tanpa tahu ada biaya tambahan.
 *
 * Lingkungan tes proyek ini `node` (tanpa jsdom dan tanpa plugin Svelte), jadi
 * yang diuji adalah STRUKTUR komponen hasil kompilasi — bukan perilaku DOM.
 * Yang diperiksa adalah hal-hal yang, bila hilang, membuat dialog ini bohong
 * atau menjebak.
 */

const SUMBER = readFileSync("src/lib/components/PersetujuanOngkir.svelte", "utf8");
const KERANJANG = readFileSync("src/routes/keranjang/+page.svelte", "utf8");
const PRODUK = readFileSync("src/routes/kurma/[slug]/+page.svelte", "utf8");

/** Isi blok <script> saja — komentar di markup tidak ikut dinilai. */
function skrip(sumber: string): string {
  const hasil = /<script[^>]*>([\s\S]*?)<\/script>/.exec(sumber);
  return hasil?.[1] ?? "";
}

describe("dialog persetujuan ongkir", () => {
  it("memakai role=dialog, aria-modal, dan focusDialog sekaligus", () => {
    // aria-modal tanpa focusDialog adalah kebohongan: pembaca layar tetap
    // membaca halaman di belakang (DESIGN.md §12).
    //
    // Diperiksa lewat AST kompilasi, BUKAN `toContain` pada teks sumber.
    // Dua jebakan yang sudah terbukti menipu:
    //  1. komentar kepala berkas menyebut "focusDialog", dan Svelte membawa
    //     komentar itu ke kode hasil — `toContain` pada kode tetap lulus
    //     walau direktifnya dihapus;
    //  2. `import { focusDialog }` juga berisi kata yang sama.
    // Yang menentukan hanyalah node `Action` di AST.
    const ast = compile(SUMBER, { filename: "PersetujuanOngkir.svelte", generate: "client" }).ast;
    const aksi: string[] = [];
    const telusuri = (node: unknown): void => {
      if (!node || typeof node !== "object") return;
      const n = node as Record<string, unknown>;
      if (n.type === "Action") aksi.push(String(n.name));
      for (const nilai of Object.values(n)) {
        if (Array.isArray(nilai)) nilai.forEach(telusuri);
        else if (nilai && typeof nilai === "object") telusuri(nilai);
      }
    };
    telusuri(ast);
    expect(aksi, "use:focusDialog harus terpasang sebagai aksi").toContain("focusDialog");

    expect(SUMBER).toContain('role="dialog"');
    expect(SUMBER).toContain('aria-modal="true"');
  });

  it("judul dan isi tertaut lewat aria-labelledby/describedby yang id-nya ada", () => {
    const judul = /aria-labelledby="([^"]+)"/.exec(SUMBER)?.[1];
    const isi = /aria-describedby="([^"]+)"/.exec(SUMBER)?.[1];
    expect(judul).toBeTruthy();
    expect(isi).toBeTruthy();
    // Setiap id yang dirujuk harus benar-benar ada di markup.
    expect(SUMBER).toContain(`id="${judul}"`);
    expect(SUMBER).toContain(`id="${isi}"`);
  });

  it("tombol setuju memanggil onlanjut, tombol kembali memanggil onkembali", () => {
    const lanjut = /onclick=\{onlanjut\}>([^<]*)</.exec(SUMBER);
    const kembali = /onclick=\{onkembali\}>([^<]*)</.exec(SUMBER);
    expect(lanjut?.[1]).toContain("Ya, saya setuju");
    expect(kembali?.[1]).toContain("Belum, kembali");
  });

  it("Escape berarti BATAL, tidak pernah berarti lanjut", () => {
    // Kalau Escape memanggil onlanjut, menutup dialog justru memesan barang.
    const penanganEscape = /Escape' && (\w+)\(\)/.exec(SUMBER);
    expect(penanganEscape?.[1], "Escape harus memanggil onkembali").toBe("onkembali");
  });

  it("menyebut Grab/Gojek dan pembayaran ke kurir secara eksplisit", () => {
    // Inti pesannya tidak boleh hilang saat teks dirapikan nanti.
    expect(SUMBER).toMatch(/Grab/);
    expect(SUMBER).toMatch(/Gojek/);
    expect(SUMBER).toMatch(/dibayar langsung ke kurir/i);
    expect(SUMBER).toMatch(/tidak termasuk/i);
  });

  it("memakai gambar kurir yang benar-benar ada di static/", () => {
    const src = /src="(\/images\/[^"]+)"/.exec(SUMBER)?.[1];
    expect(src).toBe("/images/kurir-ongkir.webp");
    const berkas = readFileSync(`static${src}`);
    // WebP animasi diawali "RIFF" dan bertanda "WEBP".
    expect(berkas.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(berkas.subarray(8, 12).toString("ascii")).toBe("WEBP");
    // Batas ukuran: gambar modal tidak boleh lebih dari 200 KB.
    expect(berkas.length).toBeLessThan(200 * 1024);
  });

  it("mengunci gulir latar selama terbuka dan memulihkannya", () => {
    const isi = skrip(SUMBER);
    expect(isi).toContain("document.body.style.overflow = 'hidden'");
    // Nilai sebelumnya WAJIB dipulihkan, bukan dikosongkan.
    expect(isi).toMatch(/document\.body\.style\.overflow = sebelumnya/);
    expect(isi).toMatch(/return \(\) =>/);
  });

  it("kompilasi Svelte lolos tanpa galat", () => {
    const hasil = compile(SUMBER, { filename: "PersetujuanOngkir.svelte", generate: "client" });
    expect(hasil.js.code.length).toBeGreaterThan(500);
  });
});

describe("pemasangan dialog di halaman", () => {
  it("keranjang: tombol checkout menahan navigasi sebelum persetujuan", () => {
    // Tanpa preventDefault, pembeli melesat ke checkout tanpa melihat dialog.
    expect(skrip(KERANJANG)).toContain("event.preventDefault()");
    expect(KERANJANG).toContain("onclick={bukaPersetujuan}");
    expect(KERANJANG).toContain("<PersetujuanOngkir");
  });

  it("keranjang: tanpa JavaScript tautan tetap menuju checkout", () => {
    // href tidak boleh dihapus; dialog hanya lapisan di atasnya.
    expect(KERANJANG).toMatch(/<a class="btn" href="\/checkout"/);
  });

  it("keranjang: batal hanya menutup dialog, keranjang tidak disentuh", () => {
    const batal = /onkembali=\{\(\) => \(setujuTerbuka = false\)\}/.test(KERANJANG);
    expect(batal).toBe(true);
    // Tidak ada pemanggilan yang mengosongkan keranjang saat batal.
    expect(skrip(KERANJANG)).not.toMatch(/onkembali[\s\S]{0,120}cart\.(clear|remove)/);
  });

  it("produk: 'Beli langsung' lewat dialog, bukan langsung goto", () => {
    const isi = skrip(PRODUK);
    const badanBuyNow = /function buyNow\(\)[^{]*\{([\s\S]*?)\n\t\}/.exec(isi)?.[1] ?? "";
    expect(badanBuyNow, "buyNow harus membuka dialog").toContain("setujuTerbuka = true");
    expect(badanBuyNow, "buyNow tidak boleh langsung goto").not.toContain("goto(");
    // goto hanya terjadi setelah setuju.
    expect(isi).toMatch(/function lanjutKeCheckout\(\)[\s\S]{0,200}goto\('\/checkout\?beli=1'\)/);
  });

  it("produk: batal membuang pilihan 'beli langsung' yang tadi disiapkan", () => {
    // Kalau dibiarkan, pilihan lama diam-diam terpakai pada kunjungan berikutnya.
    expect(skrip(PRODUK)).toMatch(/function batalPersetujuan\(\)[\s\S]{0,160}clearDirectBuy\(\)/);
  });
});
