import crypto from "crypto";

function base32Encode(buf: Buffer): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let value = 0;
  let output = "";
  for (let i = 0; i < buf.length; i++) {
    value = (value << 8) | buf[i];
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += alphabet[(value << (5 - bits)) & 31];
  return output;
}

export function generateSecret(): { secret: string; base32: string } {
  const buf = crypto.randomBytes(10);
  const base32 = base32Encode(buf);
  return { secret: buf.toString("hex"), base32 };
}

export function verifyToken(secretHex: string, token: string): boolean {
  const secret = Buffer.from(secretHex, "hex");
  const epoch = Math.floor(Date.now() / 30000);

  for (let offset = -1; offset <= 1; offset++) {
    const time = Buffer.alloc(8);
    time.writeBigInt64BE(BigInt(epoch + offset), 0);

    const hmac = crypto.createHmac("sha1", secret).update(time).digest();
    const offsetBits = hmac[hmac.length - 1] & 0xf;
    const code = ((hmac[offsetBits] & 0x7f) << 24 | (hmac[offsetBits + 1] & 0xff) << 16 | (hmac[offsetBits + 2] & 0xff) << 8 | (hmac[offsetBits + 3] & 0xff)) % 1000000;

    if (code.toString(10).padStart(6, "0") === token) return true;
  }

  return false;
}
