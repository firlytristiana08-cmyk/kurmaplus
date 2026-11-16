// Pesan validasi bawaan peramban berbahasa Inggris (misalnya "Please match the
// requested format." atau "Please fill out this field.") tidak ramah pembeli.
// Util ini menggantinya dengan pesan Indonesia lewat setCustomValidity saat
// event `invalid` (yang tidak menggelembung, sehingga dipasang dalam fase
// tangkap pada elemen form) dan membersihkannya saat pengguna mengetik.

type ValidatedField = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

function isField(target: EventTarget | null): target is ValidatedField {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

export function handleInvalid(event: Event): void {
  if (!isField(event.target)) {
    return;
  }
  const field = event.target;
  const fallback = field.dataset.validationMessage ?? "Isian belum sesuai format.";
  if (field.validity.valueMissing) {
    field.setCustomValidity("Bagian ini wajib diisi.");
  } else if (field.validity.tooShort) {
    const minLength = "minLength" in field ? field.minLength : 0;
    field.setCustomValidity(`Terlalu pendek — minimal ${minLength} karakter.`);
  } else if (field.validity.rangeUnderflow || field.validity.rangeOverflow) {
    field.setCustomValidity("Nilai di luar batas yang diperbolehkan.");
  } else {
    field.setCustomValidity(fallback);
  }
}

export function clearInvalid(event: Event): void {
  if (!isField(event.target)) {
    return;
  }
  event.target.setCustomValidity("");
}
