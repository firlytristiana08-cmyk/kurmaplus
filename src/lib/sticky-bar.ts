// Deteksi "sedang menempel" untuk .sticky-bar. CSS tidak punya pseudo-class
// :stuck, jadi dipasang penanda 1px di posisi alami bar: saat penanda keluar
// layar, bar sedang melayang (menempel) — kelas is-stuck menyalakan latarnya.
import type { Action } from "svelte/action";

export const stickyBar: Action<HTMLElement> = (node) => {
  const marker = document.createElement("div");
  marker.setAttribute("aria-hidden", "true");
  marker.style.cssText = "height:1px;pointer-events:none";
  node.insertAdjacentElement("beforebegin", marker);

  const observer = new IntersectionObserver((entries) => {
    const entry = entries[0];
    if (entry) node.classList.toggle("is-stuck", !entry.isIntersecting);
  });
  observer.observe(marker);

  return {
    destroy() {
      observer.disconnect();
      marker.remove();
    },
  };
};
