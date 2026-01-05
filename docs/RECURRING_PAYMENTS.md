# Recurring Payments - Lumen Browser

## Overview

The Lumen Browser now features a comprehensive **Recurring Payments** system that allows users to schedule automatic payments, manage subscriptions, and receive payment reminders.

## Features

### ✅ Schedule Automatic Payments
- Set up recurring payments with flexible frequency options
- Choose from daily, weekly, bi-weekly, monthly, quarterly, or yearly schedules
- Set start and end dates for payment series
- Limit total number of payments

### ✅ Subscription Management
- Track all active, paused, and completed subscriptions
- Categorize payments (subscriptions, bills, donations, rent, etc.)
- View payment history and success rates
- Edit or cancel subscriptions at any time

### ✅ Payment Reminders
- Get notified before payments are due
- Customize reminder timing (same day to 1 week before)
- Dismiss individual reminders
- Visual reminder cards with upcoming payment info

### ✅ Smart Execution
- Automatic payment execution on schedule
- Transaction status tracking
- Success/failure history
- Error logging and retry logic

## Getting Started

### Creating a Recurring Payment

1. **Navigate to Recurring Payments**
   - Open the Wallet page
   - Click "Recurring" in the sidebar

2. **Click "New Payment"**
   - A modal will appear with the payment creation form

3. **Fill in Payment Details**
   - **Payment Name**: A descriptive name (e.g., "Netflix Subscription")
   - **Description**: Optional notes about the payment
   - **Category**: Choose from subscription, bill, donation, rent, salary, or other
   - **Recipient Address**: The wallet address to send payments to
     - Use the QR code button to scan an address
   - **Amount**: How much LMN to send each time
   - **Frequency**: How often to make payments
   - **Start Date**: When to begin the payment series
   - **End Date** (Optional): When to stop payments
   - **Maximum Payments** (Optional): Limit total number of payments

4. **Configure Reminders**
   - Enable/disable payment reminders
   - Choose how many days before payment to be reminded

5. **Review and Save**
   - Check the payment summary
   - Click "Schedule Payment"

### Managing Payments

#### View Payment Status
Each payment card displays:
- Payment name and category
- Current status (Active, Paused, Completed, Failed)
- Amount and frequency
- Next payment date
- Recipient address
- Success rate (successful payments / total payments)

#### Available Actions
- **View History**: See all past payment attempts
- **Edit**: Modify payment details
- **Pause**: Temporarily stop payments
- **Resume**: Restart paused payments
- **Delete**: Permanently remove payment schedule

#### Filter Payments
- By status: All, Active, Paused, Completed
- By category: All, Subscriptions, Bills, Donations, etc.

## Payment Execution

### Automatic Execution
The system automatically checks for due payments and executes them when:
- The current date/time matches or exceeds the next payment date
- The payment status is "Active"
- The wallet has sufficient balance

### Manual Execution
While the system is designed for automatic execution, payments can also be triggered manually through the execute function.

### Execution Flow
1. Check if payment is due
2. Verify wallet balance
3. Execute transaction
4. Record result in payment history
5. Update payment statistics
6. Calculate next payment date
7. Create next reminder (if enabled)

## Payment Reminders

### How Reminders Work
- Reminders are created when a payment is scheduled
- They appear in the "Upcoming Payments" section
- Show payment name, amount, and relative date
- Can be dismissed individually

### Reminder Timing Options
- **Same day**: Reminder on payment day
- **1 day before**: 24 hours notice
- **2 days before**: 48 hours notice
- **3 days before**: 72 hours notice
- **1 week before**: 7 days notice

### Reminder Display
Reminders show:
- 📱 Payment name
- 💰 Amount (in LMN)
- 📅 Scheduled date (formatted as "Today", "Tomorrow", "in X days", or full date)

## Technical Details

### Data Storage
All recurring payment data is stored locally in browser localStorage:
- **lumen_recurring_payments**: Payment configurations
- **lumen_payment_history**: Execution history
- **lumen_payment_reminders**: Active reminders

### Data Persistence
- Payments survive page refreshes
- History is maintained indefinitely
- Reminders are automatically cleaned up

### Payment Frequencies

| Frequency | Interval | Payments per Year |
|-----------|----------|-------------------|
| Daily | Every day | 365 |
| Weekly | Every 7 days | 52 |
| Bi-weekly | Every 14 days | 26 |
| Monthly | Every month | 12 |
| Quarterly | Every 3 months | 4 |
| Yearly | Every year | 1 |

### Payment Statuses

| Status | Description |
|--------|-------------|
| Active | Payment is scheduled and will execute automatically |
| Paused | Payment is temporarily stopped |
| Completed | Payment series has finished (max payments reached or end date passed) |
| Failed | Last execution attempt failed |

## Use Cases

### Subscriptions
Perfect for managing recurring service payments:
- Streaming services (Netflix, Spotify)
- Cloud storage (Google Drive, Dropbox)
- Software subscriptions (Adobe, Microsoft 365)
- Gaming subscriptions

### Bills
Automate regular bill payments:
- Rent payments
- Utilities (if accepting crypto)
- Phone/internet bills
- Insurance premiums

### Donations
Support causes automatically:
- Monthly charity donations
- Content creator support (Patreon-style)
- Open source project funding
- Regular tithes or offerings

### Salaries
For businesses paying employees:
- Weekly/bi-weekly payroll
- Monthly salaries
- Contractor payments

## Best Practices

### Security
1. **Verify Recipient Addresses**: Always double-check addresses before scheduling
2. **Start with Small Amounts**: Test new payments with smaller amounts first
3. **Monitor Balance**: Ensure wallet has sufficient funds for upcoming payments
4. **Review Regularly**: Check payment history monthly

### Organization
1. **Use Descriptive Names**: Make payments easy to identify
2. **Add Notes**: Include important details in the description
3. **Categorize Properly**: Use categories for better organization
4. **Set End Dates**: Avoid unwanted payments after subscription ends

### Efficiency
1. **Batch Similar Payments**: Schedule all subscriptions on the same day
2. **Enable Reminders**: Get advance notice to ensure balance
3. **Set Max Payments**: Limit duration for trial periods
4. **Use Categories**: Filter payments by type easily

## Troubleshooting

### Payment Not Executing
**Possible Causes:**
- Payment is paused
- Insufficient wallet balance
- Wallet not connected
- Network issues

**Solutions:**
1. Check payment status (should be "Active")
2. Verify wallet balance
3. Ensure wallet is connected
4. Check payment history for error messages

### Reminder Not Showing
**Possible Causes:**
- Reminders disabled for this payment
- Reminder was dismissed
- Reminder date is in the past

**Solutions:**
1. Edit payment and enable reminders
2. Check if reminder was already dismissed
3. Verify reminder timing settings

### Payment History Empty
**Possible Causes:**
- No payments have executed yet
- Next payment date is in the future
- Payment was just created

**Solutions:**
1. Wait for the first scheduled payment
2. Check the "Next Payment" date on the card
3. Payments won't show history until first execution

### Unable to Edit Payment
**Possible Causes:**
- Payment is currently executing
- Browser local storage is full

**Solutions:**
1. Wait a moment and try again
2. Clear browser cache (may lose other data)
3. Delete old completed payments

## API Reference

### RecurringPayment Interface
```typescript
interface RecurringPayment {
  id: string;
  name: string;
  description?: string;
  recipient: string;
  amount: number;
  denom: string;
  frequency: PaymentFrequency;
  startDate: Date;
  endDate?: Date;
  nextPaymentDate: Date;
  lastPaymentDate?: Date;
  status: PaymentStatus;
  totalPayments: number;
  successfulPayments: number;
  failedPayments: number;
  maxPayments?: number;
  reminderEnabled: boolean;
  reminderDaysBefore: number;
  category?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### Service Methods

#### Create Payment
```typescript
service.createRecurringPayment({
  name: 'Netflix',
  recipient: 'lumen1abc...',
  amount: 15.99,
  denom: 'ulmn',
  frequency: 'monthly',
  startDate: new Date(),
  nextPaymentDate: new Date(),
  status: 'active',
  reminderEnabled: true,
  reminderDaysBefore: 1
});
```

#### Update Payment
```typescript
service.updateRecurringPayment(paymentId, {
  amount: 19.99,
  frequency: 'quarterly'
});
```

#### Pause/Resume
```typescript
service.pauseRecurringPayment(paymentId);
service.resumeRecurringPayment(paymentId);
```

#### Delete Payment
```typescript
service.deleteRecurringPayment(paymentId);
```

#### Get Payment History
```typescript
const history = service.getPaymentHistory(paymentId);
```

## Future Enhancements

### Planned Features
- [ ] Multi-token support (not just LMN)
- [ ] Payment templates
- [ ] Bulk payment actions
- [ ] Export payment history (CSV, JSON)
- [ ] Email/push notifications
- [ ] Payment analytics dashboard
- [ ] Split payments (multiple recipients)
- [ ] Conditional payments (if balance > X)
- [ ] Integration with calendar apps
- [ ] Payment approval workflow
- [ ] Backup/restore payment configurations

### Integration Opportunities
- [ ] WalletConnect for dApp subscriptions
- [ ] IPFS for payment receipts
- [ ] Smart contracts for escrow
- [ ] DAO integration for treasury management
- [ ] Multi-sig wallets for business payments

## Statistics Dashboard

The recurring payments view includes a statistics section showing:
- **Active Payments**: Number of currently active recurring payments
- **Paused Payments**: Number of temporarily paused payments
- **Monthly Total**: Estimated total monthly expenses in LMN

## Categories

Pre-defined categories help organize payments:
- **Subscription**: For services like streaming, software, etc.
- **Bill**: Utilities, rent, insurance, etc.
- **Donation**: Charitable giving, tips, support
- **Rent**: Monthly rent payments
- **Salary**: Payroll and contractor payments
- **Other**: Miscellaneous payments

## Security Considerations

### Private Key Safety
- Recurring payments never store private keys
- Uses existing wallet integration
- Requires wallet to be connected for execution

### Transaction Safety
- All payments are recorded in history
- Failed transactions don't retry automatically
- Users can review before resuming failed payments

### Data Privacy
- All data stored locally (no server-side storage)
- No payment data transmitted to third parties
- Users control their own data

## Support

For issues or feature requests:
- GitHub Issues: [lumen-browser/issues](https://github.com/lumen/browser/issues)
- Documentation: This file
- Community: Lumen Network Discord

---

**Version:** 1.0.0  
**Last Updated:** January 2026  
**Status:** Production Ready  
**License:** MIT
