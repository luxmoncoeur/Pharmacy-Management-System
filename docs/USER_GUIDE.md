# User guide

This guide is for the people who use the system every day: cashiers, pharmacists, and managers. Each task is a few short steps. The words in **bold** are the buttons and labels you will see on the screen.

## Signing in

1. Open the system in your browser. Your manager gives you the address, for example `http://localhost:3000`.
2. Type your **Username** and **Password**, then click **Sign in**.
3. Cashiers go straight to **Sell**. Everyone else starts at **Home**.

Never share your account. The system records who did what.

To change your password, click your name at the bottom left, then **Account and password**.

## What each role can do

| | Cashier | Pharmacist | Manager |
|---|:-:|:-:|:-:|
| Sell and print receipts | ✓ | ✓ | ✓ |
| Give out a prescription that a pharmacist has checked | ✓ | ✓ | ✓ |
| Record a prescription (it waits for a pharmacist) | ✓ | ✓ | ✓ |
| Check (verify or reject) a prescription | | ✓ | |
| Receive a delivery | | ✓ | ✓ |
| Remove expired or damaged stock | | ✓ | ✓ |
| Correct a shelf count, fix lot details | | | ✓ |
| Add or edit medicines and prices | | | ✓ |
| Send stock to another branch | | | ✓ |
| Void a sale | | | ✓ |
| Reports and Settings | | | ✓ |

The **owner** is a manager with no branch. The owner sees every branch, and is the only one who can add staff accounts and branches.

---

## For everyone at the counter

### Make a sale

1. Click **Sell**.
2. Type part of the medicine's name or brand, or scan its barcode. Click the medicine to add it to the sale.
3. Change the quantity with **+** and **−** if needed.
4. If the customer is a Senior Citizen or PWD, type their name in **Customer** and choose the **20%** discount. Their ID must already be saved (see [Add a customer](#add-a-customer)).
5. Click **Charge**, choose **Cash**, **GCash**, or **Card**, and enter the amount received or the reference number.
6. Print the receipt.

The system always sells the stock that expires first, and it will not sell expired stock.

### Give out a prescription

The prescription must already be checked by a pharmacist.

1. Click **Sell**, then **Give out a checked prescription**.
2. Choose the prescription. The medicines are added to the sale for you.
3. If you are giving out only part of it (for example, because of low stock), lower the quantity. The rest stays on the prescription for next time.
4. Charge and print the receipt as usual.

A prescription is valid for **180 days** from the date written. After that, the rest of it can no longer be given out; ask the patient for a new prescription.

### Record a prescription

1. Click **Prescriptions**, then **Record a prescription**. You can also use the button on **Home**.
2. In **Patient**, type the patient's name. If they are new, click **New patient** and enter their name.
3. Copy the **Doctor's name**, **Doctor's PRC license no.**, and **Date written** from the paper.
4. Add each medicine, its quantity, and the instructions.
5. Click **Save** (pharmacists see **Save for later**). A pharmacist will check it before it can be given out.

### Show or print a prescription record

Patients, doctors, or inspectors may ask to see a prescription.

1. Click **Prescriptions** and open the prescription.
2. Click **Print record**.

The record shows the patient, the doctor and their PRC number, the medicines and instructions, the pharmacist who verified it and their PRC number, and every time medicine was given out.

### Add a customer

1. Click **Customers**, then **Add customer**.
2. Enter the name and, if you like, the mobile number.
3. For a Senior Citizen or PWD, choose the type in **Senior Citizen or PWD?** and type their **ID number**.
4. Click **Add customer**.

### Look up a medicine

Click **Medicines & Stock** and type the name, brand, or barcode. You will see the price, how many are in stock, and when the next lot expires. Prices are the same at every branch.

### Notifications

The **bell** at the top right shows what needs you, with a red count for anything new. It checks by itself every minute.

- **Cashiers** are told when a prescription they recorded is checked (ready to give out) or rejected, with the reason.
- **Pharmacists** are told about new prescriptions to check, and about expired, out-of-stock, low and expiring stock.
- **Managers** also see voided sales and PRC licenses that are about to expire.

New prescriptions (and prescriptions you recorded that were just checked) also pop up at the bottom of the screen. To get these alerts even when the browser tab is in the background, open the bell and click **Turn on desktop alerts**.

### Close the day

At the end of your shift, count the cash drawer:

1. Click **Sales**, then **Close the day**.
2. Enter the **Opening cash** (the change fund you started with).
3. Count each kind of bill and enter how many, then the coins total. The system adds them up.
4. It compares what you counted with what should be there (opening cash plus today's cash sales) and shows **Balanced**, **Short**, or **Over**. Add a note if something explains a difference.
5. Click **Print closing slip**, sign it, and hand it to the manager with the cash.

The count is not saved in the system, so the signed slip is the record. Managers can count for anyone at their branch, and for past days.

---

## For pharmacists

### Check a prescription

1. On **Home**, click **Check prescriptions**. You can also click **Prescriptions**, then **To check**.
2. Open the prescription and compare it with the paper:
   - the doctor's name, signature, and PRC license number are there
   - the patient's name matches
   - the date is recent (within 180 days), and the medicines and amounts match
3. Click **Verify** if everything matches. Otherwise, click **Reject** and write the reason. The counter staff will see it.

If you have the paper in your hand while recording a prescription, click **Save and verify** to do both at once.

Your PRC license must be saved on your account and must not be expired. If it has expired, ask the owner to update it.

Prescriptions written more than **180 days** ago cannot be verified. The system shows them as **Expired**; reject them and ask the patient for a new one.

### Receive a delivery

1. Click **Receive delivery** on **Home** or **Medicines & Stock**.
2. Choose the medicine.
3. Enter **How many?**, the **Expiry date**, and the **Lot number**, all as printed on the box.
4. Open **More details (optional)** if you want to record the supplier and the cost. Type the supplier's name; names you used before are suggested.
5. Click **Add to stock**.

If the same lot was delivered before, the new units are added to it. If the lot number is already on file with a different expiry date, the system stops you. Check the box again; one of the two was probably typed wrong.

### Remove expired or damaged stock

1. On **Home**, look at **Needs attention**. Expired stock is listed first. You can also click **Medicines & Stock**, then **Expired**.
2. Open the medicine. Under **Stock by expiry date**, click **Remove expired** (or **Remove**) on the lot.
3. Choose **Expired** or **Damaged or unusable**, enter how many, and add a note if you like.
4. Click **Save**. Dispose of expired medicine following your FDA disposal procedure.

---

## For managers

### Check what needs attention

**Home** shows today's sales, prescriptions waiting to be checked, and the **Needs attention** list (expired, expiring soon, running low). It also warns you when a pharmacist's PRC license is about to expire.

On **Medicines & Stock**, click **Running low** to see a **Suggested order** for each medicine. It covers about a month of recent sales.

### Add or change a medicine

1. Click **Medicines & Stock**, then **Add medicine**. To change one, open it and click **Edit details**.
2. Fill in the name, brand, strength, form, price, and when to warn you that it is running low.
3. Tick **Needs a prescription (Rx)** for prescription-only medicines.

For **Category**, pick one of the suggestions or type a new one.

There is one price for each medicine across all branches, so a change made by any manager applies everywhere.

### Fix a lot's details

Open the medicine and click the pencil on a lot to fix a typo in its lot number, expiry date, or cost. Expiry dates are protected: an expired lot cannot be re-dated (remove it as expired instead), and once units from a lot have been sold, its expiry date can only be moved earlier.

### Correct a shelf count

If the number on the shelf does not match the system:

1. Open the medicine in **Medicines & Stock** and click **Remove** on the lot.
2. Choose **Shelf count is different**, then enter the number you counted.

### Send stock to another branch

1. Open the medicine in **Medicines & Stock**.
2. Click **Send to another branch**, choose the branch, and enter how many.
3. Click **Send stock**. The stock leaves your branch and arrives at the other branch right away, with the same lot numbers and expiry dates.

### Void a sale

1. Click **Sales** and open the sale.
2. Click **Void sale** and write the reason. The medicine goes back on the shelf, and the receipt is kept, marked as voided.

### Reports

1. Click **Reports** and choose **Sales summary**, **Best-selling medicines**, or **Stock and expiry**.
2. Choose the dates.
3. Click **Print**, or **Download (Excel/CSV)** to open it in Excel.

### Settings

**Settings** has **Staff accounts**. The owner also sees **Branches**. There is nothing to set up for categories or suppliers: you type them where you use them.

To add a staff account (owner only): open **Staff accounts**, click **Add staff account**, then choose the role and the branch. For a pharmacist, enter their PRC license number and its expiry date. Leave the branch as **All branches** only for another owner.

---

## When something goes wrong

| What you see | What to do |
|---|---|
| "Needs a prescription" at Sell | The medicine is marked Rx. Use **Give out a checked prescription**. If the prescription is not there yet, record it and ask a pharmacist to check it. |
| "Only N in stock" | There is not enough stock that has not expired. Sell what is available, or ask a manager to send stock from another branch. |
| The Senior Citizen or PWD discount is missing | Save the customer's ID on the **Customers** page first. |
| "This prescription was written N days ago" | Prescriptions are valid for 180 days. Ask the patient for a new prescription. |
| "Lot … is already on file with expiry …" | The lot number was received before with a different expiry date. Check the box for the right lot number and expiry. |
| "Your PRC license on file has expired" | Ask the owner to update your license in **Settings**, **Staff accounts**. |
| You are signed out | Sign in again. This also happens after the sample data is reset. |
