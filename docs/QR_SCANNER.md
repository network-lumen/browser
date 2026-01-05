# QR Code Scanner - Lumen Browser

## Overview

The Lumen Browser now includes a comprehensive QR code scanner that enables users to:
- ✅ Scan wallet addresses for quick transactions
- ✅ Scan payment requests with pre-filled amounts
- ✅ Scan WalletConnect QR codes for dApp connections

## Features

### 1. Wallet Address Scanning
Scan QR codes containing wallet addresses to quickly fill the recipient field when sending tokens.

**Supported formats:**
- Raw wallet addresses (e.g., `lumen1abc123...`)
- Cosmos-compatible addresses (e.g., `cosmos1xyz789...`)

### 2. Payment Request Scanning
Scan QR codes with embedded payment information.

**Supported format:**
```
lumen:ADDRESS?amount=AMOUNT&memo=MEMO
```

**Example:**
```
lumen:lumen1abc123def456?amount=10.5&memo=Coffee
```

This will automatically fill:
- Recipient address: `lumen1abc123def456`
- Amount: `10.5` LMN
- Memo: `Coffee` (when memo support is added)

### 3. WalletConnect QR Scanning
Scan WalletConnect QR codes to connect to decentralized applications (dApps).

**Format:** `wc:TOPIC@VERSION?relay-protocol=...`

**Status:** Foundation implemented, full integration requires additional setup.

## Usage

### Opening the Scanner

1. Navigate to the Wallet page
2. Click "Send" to open the send transaction modal
3. Click the QR code icon (📱) in the "To" field
4. Allow camera permissions when prompted
5. Position the QR code within the scanning frame

### Scanning Process

1. The scanner automatically detects and decodes QR codes
2. Type detection happens automatically:
   - Wallet Address
   - Payment Request
   - WalletConnect
   - URL
   - Unknown

3. After successful scan:
   - View the detected type and content
   - Click "Use This" to apply the scanned data
   - Or click "Scan Again" to scan another code

### Camera Permissions

The scanner requires camera access to function. If denied:
- An error message will be displayed
- Click "Try Again" to re-request permissions
- Check your browser settings if the permission request doesn't appear

## Technical Implementation

### Components

#### QrScanner.vue
Location: `src/components/QrScanner.vue`

**Props:**
- `title`: String - Modal title (default: "Scan QR Code")
- `acceptedTypes`: Array - Accepted QR code types (default: all types)

**Events:**
- `@close`: Emitted when scanner is closed
- `@scan`: Emitted when QR code is successfully scanned
  - Payload: `{ type: string, content: string, raw: string }`

**Features:**
- Real-time QR code detection using ZXing library
- Automatic type detection
- Mobile-responsive design
- Camera stream management
- Error handling

### Services

#### walletconnect.ts
Location: `src/internal/services/walletconnect.ts`

Provides WalletConnect integration framework:
- Session management
- Connection handling
- Transaction signing infrastructure

**Note:** Full WalletConnect functionality requires installing additional packages:
```bash
npm install @walletconnect/core @walletconnect/utils @walletconnect/types
```

### Integration Points

#### WalletPage.vue
The QR scanner is integrated into the Wallet page with:

**Functions:**
- `openQrScanner()` - Opens the scanner modal
- `closeQrScanner()` - Closes the scanner
- `handleQrScan(data)` - Processes scanned QR data
- `handleWalletConnectUri(uri)` - Handles WalletConnect URIs

**UI Elements:**
- QR code button in send modal's "To" field
- Scanner modal overlay
- Success/error toast notifications

## QR Code Generation

To create payment request QR codes that work with the scanner:

### JavaScript Example
```javascript
import QRCode from 'qrcode';

// Simple address
await QRCode.toDataURL('lumen1abc123def456');

// Payment request
const paymentUri = 'lumen:lumen1abc123def456?amount=10.5&memo=Payment';
await QRCode.toDataURL(paymentUri);

// WalletConnect (v2)
const wcUri = 'wc:topic@2?relay-protocol=irn&symKey=key';
await QRCode.toDataURL(wcUri);
```

### Command Line Example
```bash
# Using qrencode (Linux/Mac)
echo "lumen:lumen1abc123def456?amount=10.5" | qrencode -o payment.png

# Using online generator
# Visit: https://www.qr-code-generator.com/
```

## Browser Compatibility

### Supported Browsers
- ✅ Chrome/Chromium 87+
- ✅ Edge 87+
- ✅ Firefox 80+
- ✅ Safari 14.1+ (iOS 14.3+)
- ✅ Opera 73+

### Requirements
- HTTPS connection (or localhost for development)
- Camera access permission
- Modern JavaScript support (ES2020+)

### Mobile Support
- Automatically uses rear camera on mobile devices
- Touch-optimized UI
- Responsive modal design

## Security Considerations

### Camera Access
- Camera permission is requested only when needed
- Video stream is stopped when scanner is closed
- No video recording or storage occurs

### QR Code Validation
- All scanned data is validated before use
- Malicious URLs are not automatically opened
- Payment amounts are displayed for user confirmation

### Best Practices
1. Always verify scanned addresses before confirming transactions
2. Check payment amounts in payment requests
3. Only connect to trusted dApps via WalletConnect
4. Review transaction details before signing

## Troubleshooting

### Camera Not Working
**Problem:** "No camera found on this device"
- **Solution:** Ensure your device has a working camera
- Check that no other application is using the camera

**Problem:** "Camera permission denied"
- **Solution:** 
  1. Click site settings in browser address bar
  2. Find Camera permissions
  3. Set to "Allow"
  4. Refresh the page

### QR Code Not Scanning
**Problem:** Scanner doesn't detect QR code
- **Solution:**
  1. Ensure adequate lighting
  2. Hold camera steady
  3. Position QR code within the frame corners
  4. Try moving camera closer/farther from QR code
  5. Ensure QR code is not damaged or blurry

### Wrong Type Detection
**Problem:** QR code detected as wrong type
- **Solution:**
  - The system uses heuristics for type detection
  - You can still use the "Use This" button
  - Manually verify the scanned content

## Future Enhancements

### Planned Features
- [ ] Multi-QR scanning for batch transactions
- [ ] QR code history/favorites
- [ ] Custom QR code generation for receiving
- [ ] Advanced WalletConnect features
- [ ] NFT/Token QR code support
- [ ] Offline QR code scanning
- [ ] Gallery/image upload QR scanning

### WalletConnect Roadmap
1. **Phase 1** (Current): Basic URI parsing and detection
2. **Phase 2**: Session management and approval UI
3. **Phase 3**: Transaction signing integration
4. **Phase 4**: Multi-chain support
5. **Phase 5**: Advanced dApp features

## API Reference

### QrScanner Component

```vue
<QrScanner 
  v-if="showScanner"
  :title="'Scan Wallet Address'"
  :acceptedTypes="['address', 'payment']"
  @close="handleClose"
  @scan="handleScan"
/>
```

### Scan Event Payload
```typescript
interface ScanData {
  type: string;        // 'walletaddress' | 'paymentrequest' | 'walletconnect' | 'url' | 'unknown'
  content: string;     // Processed content (e.g., just the address)
  raw: string;         // Raw scanned string
}
```

### Type Detection Logic
```typescript
function detectQRType(data: string): string {
  if (data.startsWith('wc:')) return 'WalletConnect';
  if (data.includes('amount=') || data.startsWith('lumen:')) return 'Payment Request';
  if (/^[a-zA-Z0-9]{32,}$/.test(data)) return 'Wallet Address';
  if (data.startsWith('http')) return 'URL';
  return 'Unknown';
}
```

## Dependencies

### Required
- `@zxing/library` - QR code scanning engine
- `lucide-vue-next` - UI icons
- `vue` 3.x - Framework

### Optional (for WalletConnect)
- `@walletconnect/core` - WalletConnect protocol
- `@walletconnect/utils` - Helper utilities
- `@walletconnect/types` - TypeScript definitions

## Contributing

To contribute improvements to the QR scanner:

1. Test thoroughly with various QR code types
2. Ensure mobile compatibility
3. Add appropriate error handling
4. Update documentation
5. Follow existing code style

## Support

For issues or questions:
- GitHub Issues: [lumen-browser/issues](https://github.com/lumen/browser/issues)
- Documentation: This file
- Community: Lumen Network Discord

---

**Version:** 1.0.0  
**Last Updated:** January 2026  
**Status:** Active Development
