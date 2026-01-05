# Recurring Payments & QR Scanner - Quick Reference

## New Features Summary

### 🔄 Recurring Payments System
Complete subscription and automatic payment management with reminders.

### 📱 QR Code Scanner
Scan wallet addresses, payment requests, and WalletConnect QR codes.

---

## Quick Start

### QR Scanner
1. Go to Wallet → Send
2. Click QR icon in "To" field
3. Scan QR code
4. Data auto-fills the form

**Supported:**
- Wallet addresses
- Payment requests (`lumen:address?amount=X`)
- WalletConnect URIs (`wc:...`)

### Recurring Payments
1. Go to Wallet → Recurring
2. Click "New Payment"
3. Fill in details:
   - Name, recipient, amount
   - Frequency (daily/weekly/monthly/etc.)
   - Start/end dates
   - Enable reminders
4. Click "Schedule Payment"

---

## Components

### New Files Created
```
src/
├── components/
│   ├── QrScanner.vue                    # QR code scanner
│   ├── RecurringPaymentModal.vue        # Payment creation/edit
│   └── SubscriptionsView.vue            # Main subscriptions UI
├── internal/
│   └── services/
│       ├── recurringPayments.ts         # Payment service
│       └── walletconnect.ts             # WalletConnect service
└── docs/
    ├── QR_SCANNER.md                    # QR scanner docs
    └── RECURRING_PAYMENTS.md            # Recurring payments docs
```

### Modified Files
```
src/internal/pages/WalletPage.vue        # Added recurring view & QR scanner
package.json                              # Added @zxing/library
```

---

## Features at a Glance

### QR Scanner
✅ Real-time camera scanning  
✅ Auto type detection  
✅ Mobile-optimized  
✅ Error handling  
✅ Permission management  

### Recurring Payments
✅ Schedule automatic payments  
✅ 6 frequency options (daily to yearly)  
✅ Payment reminders  
✅ Category organization  
✅ Success rate tracking  
✅ Payment history  
✅ Pause/resume functionality  
✅ QR integration for addresses  

---

## Payment Frequencies

| Frequency  | Interval      | Per Year |
|------------|---------------|----------|
| Daily      | Every day     | 365      |
| Weekly     | Every 7 days  | 52       |
| Bi-weekly  | Every 14 days | 26       |
| Monthly    | Every month   | 12       |
| Quarterly  | Every 3 mos   | 4        |
| Yearly     | Every year    | 1        |

---

## Usage Examples

### Scan Address for One-Time Payment
```
1. Wallet → Send
2. Click QR icon
3. Scan address QR
4. Amount auto-filled if payment request
5. Review and send
```

### Create Monthly Subscription
```
1. Wallet → Recurring → New Payment
2. Name: "Netflix Subscription"
3. Recipient: [scan or paste]
4. Amount: 15.99 LMN
5. Frequency: Monthly
6. Start: Today
7. Reminder: 1 day before
8. Schedule Payment
```

### Manage Existing Payment
```
1. Wallet → Recurring
2. Find payment card
3. Actions:
   - 📊 View History
   - ✏️ Edit
   - ⏸️ Pause/▶️ Resume
   - 🗑️ Delete
```

---

## Storage

All data stored in browser `localStorage`:
- `lumen_recurring_payments` - Payment configs
- `lumen_payment_history` - Execution logs
- `lumen_payment_reminders` - Active reminders

**Note:** Local storage only. Clear browser data will delete all recurring payments.

---

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Close modal | `Esc` |
| Submit form | `Enter` (when in input) |

---

## Status Indicators

### Payment Status
- 🟢 **Active** - Scheduled and executing
- 🟡 **Paused** - Temporarily stopped
- 🔵 **Completed** - Series finished
- 🔴 **Failed** - Last attempt failed

### Transaction Status
- ✅ **Success** - Transaction confirmed
- ❌ **Failed** - Transaction failed
- ⏳ **Pending** - Processing

---

## Troubleshooting

### QR Scanner Issues
**Camera not working?**
1. Check browser permissions
2. Ensure HTTPS (or localhost)
3. Try different browser

**QR not detecting?**
1. Ensure good lighting
2. Hold steady
3. Position within frame corners

### Recurring Payment Issues
**Payment not executing?**
1. Check status is "Active"
2. Verify sufficient balance
3. Check payment date hasn't passed
4. Review error in history

**Can't create payment?**
1. Fill all required fields (*)
2. Ensure valid date
3. Check amount > 0
4. Verify address format

---

## Next Steps

### Recommended Actions
1. ✅ Test QR scanner with a test address
2. ✅ Create a test recurring payment
3. ✅ Enable reminders
4. ✅ Review payment categories
5. ✅ Check payment history

### Optional Enhancements
- Set up multiple subscriptions
- Categorize all payments
- Export payment data (coming soon)
- Enable browser notifications (coming soon)

---

## Support & Resources

**Documentation:**
- [QR Scanner Guide](./QR_SCANNER.md)
- [Recurring Payments Guide](./RECURRING_PAYMENTS.md)

**Need Help?**
- GitHub Issues
- Community Discord
- In-app tooltips

---

**Version:** 1.0.0  
**Updated:** January 2026  
**Build:** Verified ✅
