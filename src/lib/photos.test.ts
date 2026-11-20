import { describe, expect, it } from "vitest";
import { parsePhotoInput, photoSrcset, pickPhotoTier } from "./photos";

describe("tingkat foto responsif", () => {
  it("memilih turunan sesuai lebar permintaan", () => {
    expect(pickPhotoTier("lg", "sm", "md", 400)).toBe("sm");
    expect(pickPhotoTier("lg", "sm", "md", 600)).toBe("sm");
    expect(pickPhotoTier("lg", "sm", "md", 800)).toBe("md");
    expect(pickPhotoTier("lg", "sm", "md", 1200)).toBe("md");
    expect(pickPhotoTier("lg", "sm", "md", 1201)).toBe("lg");
    expect(pickPhotoTier("lg", "sm", "md", 1600)).toBe("lg");
    expect(pickPhotoTier("lg", "sm", "md", 0)).toBe("lg");
  });

  it("jatuh ke tingkat yang ada bila turunan kosong (foto lama)", () => {
    expect(pickPhotoTier("lg", "", "md", 600)).toBe("md");
    expect(pickPhotoTier("lg", "", "", 600)).toBe("lg");
    expect(pickPhotoTier("lg", null, null, 1200)).toBe("lg");
  });

  it("membaca masukan form JSON dan string lama", () => {
    expect(parsePhotoInput('{"sm":"a","md":"b","lg":"c"}')).toEqual({ sm: "a", md: "b", lg: "c" });
    expect(parsePhotoInput("data:image/webp;base64,x")).toEqual({
      sm: "",
      md: "",
      lg: "data:image/webp;base64,x",
    });
    expect(parsePhotoInput("{rusak")).toEqual({ sm: "", md: "", lg: "{rusak" });
  });

  it("srcset memuat tiga tingkat ukuran", () => {
    const s = photoSrcset(7);
    expect(s).toContain("/api/foto/7?w=600 600w");
    expect(s).toContain("/api/foto/7?w=1200 1200w");
    expect(s).toContain("/api/foto/7?w=1600 1600w");
  });
});
