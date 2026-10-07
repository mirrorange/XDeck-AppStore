// Behaviour of the shared script helpers (shared/lib.sh, shared/lib.ps1).

import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const shared = join(import.meta.dirname, "..", "shared");
const pwsh = ["pwsh", "powershell"].find((c) => spawnSync(c, ["-v"]).status === 0);
let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "lib-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function bash(script: string, env: Record<string, string> = {}): string {
  return execFileSync("bash", ["-c", `. "${shared}/lib.sh"\n${script}`], {
    encoding: "utf8",
    env: { ...process.env, XDECK_APP_DIR: dir, ...env },
    cwd: dir,
  });
}

describe("lib.sh", () => {
  it("keeps state values exactly", () => {
    const tricky = `a 'b' "c" $d \\e`;
    const out = bash(
      `state_set ONE 1; state_set TWO "$V"; state_set ONE 2; state_load; printf '%s|%s' "$ONE" "$TWO"`,
      { V: tricky },
    );
    expect(out).toBe(`2|${tricky}`);
    expect(readFileSync(join(dir, ".state"), "utf8").match(/^ONE=/gm)).toHaveLength(1);
  });

  it("fails clearly without state", () => {
    const r = spawnSync("bash", ["-c", `. "${shared}/lib.sh"; state_load`], {
      env: { ...process.env, XDECK_APP_DIR: dir },
      encoding: "utf8",
    });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("reinstall the app");
  });

  it("extracts archives without their top-level folder", () => {
    mkdirSync(join(dir, "src/pkg-1.0/bin"), { recursive: true });
    writeFileSync(join(dir, "src/pkg-1.0/bin/tool"), "x");
    execFileSync("tar", ["-czf", join(dir, "pkg.tgz"), "-C", join(dir, "src"), "pkg-1.0"]);
    bash(`extract "$XDECK_APP_DIR/pkg.tgz" "$XDECK_APP_DIR/pkg"`);
    expect(readFileSync(join(dir, "pkg/bin/tool"), "utf8")).toBe("x");
  });

  it("verifies checksums", () => {
    writeFileSync(join(dir, "f"), "hello");
    const good = "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824";
    expect(() => bash(`verify_sha256 f ${good}`)).not.toThrow();
    expect(() => bash(`verify_sha256 f ${"0".repeat(64)}`)).toThrow();
  });

  it("escapes SQL strings and maps listen addresses", () => {
    expect(bash(`sql_string "$V"`, { V: `it's a \\ test` })).toBe(`'it\\'s a \\\\ test'`);
    expect(bash(`client_host 0.0.0.0; client_host 10.0.0.2; client_host`)).toBe(
      "127.0.0.1\n10.0.0.2\n127.0.0.1\n",
    );
  });

  it("writes files atomically and reads the delete-data flag", () => {
    bash(`echo hi | write_file "$XDECK_APP_DIR/conf/a.conf"`);
    expect(readFileSync(join(dir, "conf/a.conf"), "utf8")).toBe("hi\n");
    expect(bash(`delete_data_requested && echo yes || echo no`, { XDECK_DELETE_DATA: "1" })).toBe(
      "yes\n",
    );
    expect(bash(`delete_data_requested && echo yes || echo no`)).toBe("no\n");
  });
});

describe.skipIf(!pwsh)("lib.ps1", () => {
  function ps(script: string): string {
    return execFileSync(pwsh!, ["-NoProfile", "-Command", `. '${shared}/lib.ps1'; ${script}`], {
      encoding: "utf8",
      env: { ...process.env, XDECK_APP_DIR: dir },
    });
  }

  it("keeps state and writes UTF-8 without a BOM", () => {
    const out = ps(
      "Set-State 'exe' 'C:\\a b\\x.exe'; Set-State 'version' '1'; Set-State 'version' '2'; $s = Get-State; \"$($s.exe)|$($s.version)\"",
    );
    expect(out.trim()).toBe("C:\\a b\\x.exe|2");
    const bytes = readFileSync(join(dir, ".state.json"));
    expect([...bytes.subarray(0, 3)]).not.toEqual([0xef, 0xbb, 0xbf]);
  });

  it("extracts zips without their top-level folder", () => {
    mkdirSync(join(dir, "src/pkg-1.0"), { recursive: true });
    writeFileSync(join(dir, "src/pkg-1.0/tool.exe"), "x");
    execFileSync("zip", ["-qr", join(dir, "pkg.zip"), "pkg-1.0"], { cwd: join(dir, "src") });
    ps(`Expand-Into (Join-Path $AppDir 'pkg.zip') (Join-Path $AppDir 'pkg')`);
    expect(readFileSync(join(dir, "pkg/tool.exe"), "utf8")).toBe("x");
  });

  it("converts paths and checks hashes", () => {
    expect(ps("ConvertTo-SlashPath 'C:\\data\\apps'").trim()).toBe("C:/data/apps");
    writeFileSync(join(dir, "f"), "hello");
    expect(() =>
      ps(
        "Assert-Sha256 (Join-Path $AppDir 'f') '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'",
      ),
    ).not.toThrow();
    expect(() => ps(`Assert-Sha256 (Join-Path $AppDir 'f') '${"0".repeat(64)}'`)).toThrow();
  });
});
