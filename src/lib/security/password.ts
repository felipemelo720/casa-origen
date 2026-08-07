import 'server-only';

import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  type ScryptOptions,
} from 'node:crypto';

/**
 * Password hashing for customer accounts.
 *
 * `node:crypto`'s scrypt instead of a new dependency: argon2 was already
 * removed from this project once, and bcrypt/argon2 both drag a native module
 * into the Docker image for a single-restaurant customer table.
 *
 * Format: `scrypt$N$r$p$saltHex$hashHex`. The parameters travel with the hash,
 * so raising the cost later does not invalidate the rows written today.
 *
 * Node-only (unlike `session-token.ts`, which uses Web Crypto so it can run in
 * middleware). That is fine: passwords are never verified at the edge.
 */
// Hand-rolled instead of `promisify`: its type overload drops the options
// argument, and the cost parameters are the whole point of using scrypt.
function scrypt(
  password: string,
  salt: Buffer,
  keyLength: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keyLength, options, (error, derived) => {
      if (error) reject(error);
      else resolve(derived);
    });
  });
}

const N = 16_384;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
const SALT_BYTES = 16;

async function derive(password: string, salt: Buffer, keyLength: number): Promise<Buffer> {
  // `maxmem` has to be raised by hand: the default (32 MiB) rejects N=16384.
  return scrypt(password.normalize('NFKC'), salt, keyLength, {
    N,
    r: R,
    p: P,
    maxmem: 64 * 1024 * 1024,
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const hash = await derive(password, salt, KEY_LENGTH);
  return `scrypt$${N}$${R}$${P}$${salt.toString('hex')}$${hash.toString('hex')}`;
}

/**
 * Constant-time verify. Returns false — never throws — on a malformed stored
 * value, so a corrupted row denies login instead of 500-ing the action.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

  const [, rawN, rawR, rawP, saltHex, hashHex] = parts;
  const cost = Number(rawN);
  const blockSize = Number(rawR);
  const parallelism = Number(rawP);
  if (!Number.isInteger(cost) || !Number.isInteger(blockSize) || !Number.isInteger(parallelism)) {
    return false;
  }

  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(saltHex ?? '', 'hex');
    expected = Buffer.from(hashHex ?? '', 'hex');
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length === 0) return false;

  const actual = await scrypt(password.normalize('NFKC'), salt, expected.length, {
    N: cost,
    r: blockSize,
    p: parallelism,
    maxmem: 256 * 1024 * 1024,
  });

  return timingSafeEqual(actual, expected);
}
