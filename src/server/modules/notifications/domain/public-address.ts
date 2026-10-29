import { isIP } from 'node:net'

// Whether an IP literal can be a public host. Used before a webhook URL is stored, and again at connect
// time (the sender's DNS lookup), so a name that resolves to an internal address is refused too.
export function isPublicAddress(address: string): boolean {
  const family = isIP(address)
  if (family === 4) return isPublicIPv4(address.split('.').map(Number))
  if (family === 6) return isPublicIPv6(address)
  return false
}

function isPublicIPv4([a, b, c]: number[]): boolean {
  if (a === 0 || a === 10 || a === 127) return false
  if (a === 100 && b >= 64 && b <= 127) return false // carrier-grade NAT
  if (a === 169 && b === 254) return false // link-local, including cloud metadata 169.254.169.254
  if (a === 172 && b >= 16 && b <= 31) return false
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return false // IETF protocol and TEST-NET-1
  if (a === 192 && b === 168) return false
  if (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) return false // benchmark and TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return false // TEST-NET-3
  if (a >= 224) return false // multicast, reserved, broadcast
  return true
}

function isPublicIPv6(address: string): boolean {
  const groups = ipv6Groups(address)
  if (!groups) return false
  const [g0, g1, g2, g3, g4, g5, g6, g7] = groups
  const embedded = [g6 >> 8, g6 & 0xff, g7 >> 8, g7 & 0xff]
  const leadingZeros = g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0
  if (leadingZeros && g5 === 0xffff) return isPublicIPv4(embedded) // ::ffff:a.b.c.d
  if (g0 === 0x64 && g1 === 0xff9b && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0) return isPublicIPv4(embedded) // NAT64
  if (leadingZeros && g5 === 0) return false // :: unspecified, ::1 loopback, deprecated ::a.b.c.d
  if ((g0 & 0xfe00) === 0xfc00) return false // unique local fc00::/7
  if ((g0 & 0xffc0) === 0xfe80) return false // link-local fe80::/10
  if ((g0 & 0xffc0) === 0xfec0) return false // deprecated site-local fec0::/10
  if ((g0 & 0xff00) === 0xff00) return false // multicast ff00::/8
  return true
}

// Expands an IPv6 literal (with `::` and an optional trailing dotted IPv4) into eight 16-bit groups.
function ipv6Groups(address: string): number[] | null {
  let text = address.toLowerCase()
  const lastColon = text.lastIndexOf(':')
  if (text.includes('.')) {
    const parts = text
      .slice(lastColon + 1)
      .split('.')
      .map(Number)
    if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null
    text = `${text.slice(0, lastColon + 1)}${((parts[0] << 8) | parts[1]).toString(16)}:${((parts[2] << 8) | parts[3]).toString(16)}`
  }
  const halves = text.split('::')
  if (halves.length > 2) return null
  const head = halves[0] ? halves[0].split(':') : []
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : []
  let groups: string[]
  if (halves.length === 2) {
    const filler = 8 - head.length - tail.length
    if (filler < 1) return null
    groups = [...head, ...Array<string>(filler).fill('0'), ...tail]
  } else {
    groups = head
  }
  if (groups.length !== 8) return null
  const values = groups.map((group) => parseInt(group, 16))
  if (values.some((value) => !Number.isInteger(value) || value < 0 || value > 0xffff)) return null
  return values
}
