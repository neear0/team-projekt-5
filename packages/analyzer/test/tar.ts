// Pomôcka pre testy: zostaví tar.gz archív v tvare, aký posiela codeload.github.com.
import { gzipSync } from 'node:zlib';

function header(name: string, size: number, type: string): Uint8Array {
  const block = new Uint8Array(512);
  const write = (text: string, offset: number) => {
    block.set(new TextEncoder().encode(text), offset);
  };
  write(name.slice(0, 99), 0);
  write('0000644\0', 100);
  write(size.toString(8).padStart(11, '0') + '\0', 124);
  write(type, 156);
  write('ustar\0', 257);
  return block;
}

function pad(data: Uint8Array): Uint8Array {
  const out = new Uint8Array(Math.ceil(data.length / 512) * 512);
  out.set(data);
  return out;
}

/** Tar v tvare, aký posiela GitHub: globálna pax hlavička, koreňový priečinok, dlhé cesty cez pax. */
export function make_tar(files: Record<string, string>): Uint8Array {
  const parts: Uint8Array[] = [];
  const global = new TextEncoder().encode('52 comment=0123456789012345678901234567890123456789\n');
  parts.push(header('pax_global_header', global.length, 'g'), pad(global));
  parts.push(header('owner-repo-abc123/', 0, '5'));
  for (const [path, content] of Object.entries(files)) {
    const full = `owner-repo-abc123/${path}`;
    const data = new TextEncoder().encode(content);
    if (full.length > 99) {
      const record = ` path=${full}\n`;
      let length = record.length;
      length += String(length + String(length).length).length;
      const pax = new TextEncoder().encode(`${String(length)}${record}`);
      parts.push(header('PaxHeader', pax.length, 'x'), pad(pax));
    }
    parts.push(header(full, data.length, '0'), pad(data));
  }
  parts.push(new Uint8Array(1024));
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

export function make_tar_gz(files: Record<string, string>): Uint8Array {
  return gzipSync(make_tar(files));
}
