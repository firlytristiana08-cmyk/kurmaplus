import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Regresi: pita diagnostik pernah salah tampil di PRODUKSI karena deteksi mode
// dev mencari teks yang juga ada di dalam skripnya sendiri, sehingga selalu
// dianggap dev lalu mencoba memuat berkas dev yang tidak ada di produksi.
// Tes ini mengunci gerbangnya: produksi harus tanpa efek samping, dev harus
// tetap memasang pranala preload, dan skrip tidak boleh mencocokkan dirinya.

const APP_HTML = fileURLToPath(new URL("../app.html", import.meta.url));

function markedScripts(): string[] {
  const html = readFileSync(APP_HTML, "utf8");
  const scripts: string[] = [];
  const re = /<script data-kurma-diag>([\s\S]*?)<\/script>/g;
  let match = re.exec(html);
  while (match !== null) {
    scripts.push(match[1]);
    match = re.exec(html);
  }
  return scripts;
}

interface FakeScript {
  src: string;
  textContent: string;
  hasAttribute: (name: string) => boolean;
}

interface CreatedNode {
  tag: string;
  rel: string;
  href: string;
  textContent: string;
  [key: string]: unknown;
}

function run(scripts: Array<{ text: string; marked: boolean }>): CreatedNode[] {
  const created: CreatedNode[] = [];
  const fakeScripts: FakeScript[] = scripts.map((s) => ({
    src: "",
    textContent: s.text,
    hasAttribute: (name: string) => name === "data-kurma-diag" && s.marked,
  }));
  const document = {
    scripts: fakeScripts,
    createElement: (tag: string): CreatedNode => ({ tag, rel: "", href: "", textContent: "" }),
    head: { appendChild: (node: CreatedNode) => void created.push(node) },
    body: { appendChild: (node: CreatedNode) => void created.push(node) },
  };
  const window = { addEventListener: () => {} };
  const noop = () => 0;
  for (const s of scripts) {
    // eslint-disable-next-line no-new-func
    new Function("window", "document", "setInterval", "clearInterval", "setTimeout", s.text)(
      window,
      document,
      noop,
      noop,
      noop,
    );
  }
  return created;
}

const DEV_BOOTSTRAP =
  'globalThis.__sveltekit_dev = { base: "/demo", version: "1", env: {} };';
const PROD_BOOTSTRAP =
  'globalThis.__sveltekit_1a2b3c = "/x"; var start = "/_app/immutable/entry/start.abc.js";';

describe("app.html diagnostic gate", () => {
  const ours = markedScripts();

  it("extracts the marked scripts from app.html", () => {
    expect(ours.length).toBe(2);
  });

  it("does nothing in a production page", () => {
    const created = run([
      { text: PROD_BOOTSTRAP, marked: false },
      ...ours.map((text) => ({ text, marked: true })),
    ]);
    expect(created).toHaveLength(0);
  });

  it("installs modulepreloads on a dev page", () => {
    const created = run([
      { text: DEV_BOOTSTRAP, marked: false },
      ...ours.map((text) => ({ text, marked: true })),
    ]);
    expect(created.filter((n) => n.rel === "modulepreload")).toHaveLength(14);
  });

  it("never matches its own text even without markers", () => {
    const created = run(ours.map((text) => ({ text, marked: false })));
    expect(created).toHaveLength(0);
  });

  it("stays silent on a production page even without markers", () => {
    const created = run([
      { text: PROD_BOOTSTRAP, marked: false },
      ...ours.map((text) => ({ text, marked: false })),
    ]);
    expect(created).toHaveLength(0);
  });
});
