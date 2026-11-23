/**
 * Fokus dialog modal untuk portal pelanggan.
 *
 * Masalah yang diselesaikan: sebelumnya tiga dialog (foto produk, keranjang
 * berhasil, status pesanan) memakai `role="dialog"` + `aria-modal="true"`
 * tetapi TIDAK memindahkan fokus ke dalamnya. Akibatnya pembaca layar tetap
 * berada di halaman di belakang, dan Tab bisa keluar dari dialog ke elemen yang
 * secara visual tertutup — `aria-modal` yang berbohong.
 *
 * Aksi ini melakukan tiga hal saat elemen terpasang:
 * 1. memindahkan fokus ke elemen pertama yang bisa difokus (atau ke dialognya),
 * 2. menjebak Tab/Shift+Tab di dalam dialog,
 * 3. mengembalikan fokus ke elemen pemicu saat dialog ditutup.
 *
 * Escape TIDAK ditangani di sini — pemanggil sudah punya handler `onkeydown`
 * sendiri, dan menggandakannya membuat dialog tertutup dua kali.
 */
export function focusDialog(node: HTMLElement) {
  // Simpan elemen yang sedang fokus sebelum dialog dibuka, untuk dikembalikan.
  const pemicu = document.activeElement as HTMLElement | null;

  const fokusable = (): HTMLElement[] =>
    Array.from(
      node.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => el.offsetParent !== null || el === document.activeElement);

  const pindahkanFokus = (): void => {
    const pertama = fokusable()[0];
    if (pertama) {
      pertama.focus();
      return;
    }
    // Tidak ada isi yang bisa difokus: fokuskan dialognya sendiri agar
    // pembaca layar membacakan judulnya.
    if (!node.hasAttribute("tabindex")) node.setAttribute("tabindex", "-1");
    node.focus();
  };

  // Tunggu satu bingkai agar isi dialog selesai dirender.
  const raf = requestAnimationFrame(pindahkanFokus);

  const onKeydown = (event: KeyboardEvent): void => {
    if (event.key !== "Tab") return;
    const daftar = fokusable();
    if (daftar.length === 0) {
      event.preventDefault();
      return;
    }
    const pertama = daftar[0];
    const terakhir = daftar[daftar.length - 1];
    const aktif = document.activeElement as HTMLElement | null;

    // Fokus di luar dialog (mis. sempat keluar): tarik kembali ke awal.
    if (!aktif || !node.contains(aktif)) {
      event.preventDefault();
      pertama.focus();
      return;
    }
    if (event.shiftKey && aktif === pertama) {
      event.preventDefault();
      terakhir.focus();
      return;
    }
    if (!event.shiftKey && aktif === terakhir) {
      event.preventDefault();
      pertama.focus();
    }
  };

  node.addEventListener("keydown", onKeydown);

  return {
    destroy() {
      cancelAnimationFrame(raf);
      node.removeEventListener("keydown", onKeydown);
      // Kembalikan fokus ke pemicu — hanya bila masih ada di dokumen.
      if (pemicu?.isConnected) pemicu.focus();
    },
  };
}
