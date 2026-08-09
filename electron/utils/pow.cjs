// No requires, so workers/ can import it - see the rule in workers/README.md.

function leadingZeroBits(digest) {
  let total = 0;
  for (let i = 0; i < digest.length; i++) {
    const byte = digest[i];
    if (byte === 0) {
      total += 8;
      continue;
    }
    return total + Math.clz32(byte) - 24;
  }
  return total;
}

module.exports = {
  leadingZeroBits
};
