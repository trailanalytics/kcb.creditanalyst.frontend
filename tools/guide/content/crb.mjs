// CRB Officer Guide. Figures come from e2e/guide/crb.guide.ts (guide-out/crb/<id>.png).
export default {
  role: 'crb',
  kicker: 'KCB Uganda · Credit Analyst 3.0',
  title: 'CRB Officer Guide',
  subtitle: 'CBA loans, uploads and CRB submissions',
  purpose:
    'You keep the loan accounts, bounced cheques, fraud records and institution details right in Credit Analyst, build the CB011 files for the credit reference bureau, and check and correct the CBA before it is sent.',
  appliesTo: 'Credit Analyst 3.0 (Java/Vue), release under UAT, November 2026',
  audience: 'CRB officers and CRB operators in the Credit Reference Bureau reporting team',
  sections: [
    {
      title: 'Your part in the process',
      blocks: [
        {
          p: 'Every month the bank sends the credit reference bureau (CRB) a set of CB011 files in the Data Submission Manual (DSM) format. Credit Analyst builds them from what it holds: the loans that come in from T24 every night, the credit applications the branches capture, and what you upload and keep up to date.',
        },
        {
          p: 'Your part is to keep that data right, build the files, check them and correct the CBA before it goes. The files are named **CB011**, the date the file is for (yyyymmdd) and the file type, for example **CB01120260930CBA.csv**.',
        },
        {
          table: {
            head: ['File', 'What it holds', 'Dates you choose'],
            rows: [
              ['CBA', 'Customer borrower accounts: every running loan and its customer', 'The month end (To date). Built in the background'],
              ['CAP', 'Credit applications captured in the period', 'From and To'],
              ['BC', 'Bounced cheques of the period', 'From and To'],
              ['FRA', 'Fraud (financial malpractice) records', 'From and To'],
              ['BS', 'Borrower stakeholders of the borrowers in the CBA', 'To date'],
              ['CCG', 'Guarantors of the borrowers in the CBA', 'To date'],
              ['CMC', 'Collateral of the borrowers in the CBA', 'To date'],
              ['PI', 'The participating institution (KCB Bank Uganda)', 'None'],
              ['PIS', 'The stakeholders of the institution', 'None'],
              ['IB', 'The branches of the bank', 'None'],
            ],
            widths: [1200, 5200, 3200],
          },
        },
        {
          note: 'BS, CCG and CMC read the CBA, so generate the CBA first. CML (closed Mopesa loans) is listed on the form but cannot be chosen in this release.',
        },
        {
          p: 'Before you send the files you check them: the loans without collateral, guarantor or stakeholder, the submission analysis, and the PR4 analysis that compares the PR4 report with the CBA. Where the CBA is wrong you correct it with the CBA fix tools and download it again.',
        },
      ],
    },
    {
      title: 'Getting started',
      blocks: [
        {
          p: 'Open Credit Analyst in your browser and sign in with your KCB user ID or e-mail and your password. You land on your dashboard.',
        },
        {
          p: 'The green bar under the header takes you to the main areas: **Dashboard**, **Profiles**, **Output Files**, **Requests** and **Off Balance Sheet Items**. The search box in the header finds customers, credit applications and, for you, loans by contract code.',
        },
        {
          tip: 'If a page says "You don\'t have access to this page", your account lacks the permission for it. Ask your administrator to grant it.',
        },
      ],
    },
    {
      title: 'Your dashboard',
      blocks: [
        {
          p: 'The dashboard has one card for each kind of record. Click the title of a card to open its list, and the link at the bottom of the card for the most common task. A card with a small arrow has more pages in its menu.',
        },
        { fig: '01-dashboard' },
        {
          bullets: [
            '**CBA**: the running loans, with the CBA menu.',
            '**BC**: bounced cheques and their upload.',
            '**INSTITUTION** and **PIS**: the bank, its branches and its stakeholders.',
            '**REPORTS**: the CRB files, the loans without securities and the submission analysis.',
            '**ANALYSIS**: the PR4 upload and its analysis against the CBA.',
            '**PROCESSES**: long jobs that run in the background. The number on the card is how many are running now.',
            '**FRA**: fraud records.',
          ],
        },
        { h2: 'The CBA menu' },
        { p: 'Click the arrow at the bottom right of the CBA card to reach the other CBA pages.' },
        { fig: '01-cba-menu' },
      ],
    },
    {
      title: 'Looking up a CBA loan',
      blocks: [
        {
          p: 'The CBA loans list holds every loan account Credit Analyst knows, 50 at a time; more load as you scroll. Search by contract code or customer name.',
        },
        { fig: '02-loans-list' },
        {
          p: 'Loan Details shows the key facts at the top. Click **Show / Hide** for every field the CBA reports. From here you can add a collateral, guarantor or stakeholder to the loan.',
        },
        { fig: '02-loan-details' },
        { p: 'Repayments lists the payments from the T24 extract, newest first.' },
        { fig: '02-repayments' },
        { tip: 'A loan with no repayments in the extract shows "No repayments found at the moment!".' },
      ],
    },
    {
      title: 'Writing off a loan',
      blocks: [
        {
          p: 'You write off a loan from the CBA loans list. The amount starts at the current balance, in the loan\'s own currency. The closure reason is Written Off.',
        },
        {
          steps: [
            'Open the CBA loans list and search for the contract code.',
            'Point at the loan, click the arrow next to Loan Details and click **Write Off Account**.',
            'Check the amount and the closure date, then click **Write Off Loan**.',
            'Click OK on the message. The loan is now on the Written-off Credit Accounts list.',
          ],
        },
        { fig: '03-loan-row-menu' },
        { fig: '03-write-off-form' },
        {
          tip: 'Writing off the same loan again changes its write-off; it does not add a second one. An amount that is not a number or a date that does not exist is listed under "Form Validation Failed!" and nothing is saved.',
        },
        { fig: '03-write-offs-list' },
      ],
    },
    {
      title: 'Ignored and force closed accounts',
      blocks: [
        { h2: 'Ignored accounts' },
        {
          p: 'An ignored loan stays in Credit Analyst but is left out of the CBA. Open **Ignore Loan Accounts** from the CBA menu.',
        },
        {
          steps: [
            'Click **+ Add Accounts**.',
            'Type the contract codes, separated by commas.',
            'Click **Submit Accounts**, then OK.',
          ],
        },
        { fig: '04-ignore-add' },
        {
          note: 'Check the contract codes before you submit: a code that matches no loan is still put on the ignored list, and the message does not say so.',
        },
        {
          p: 'To put a loan back in the CBA, point at it on the ignored list, click the arrow and click **Remove**, then **Yes, Proceed**. You can also ignore a single loan from the CBA loans list with **Ignore Account**.',
        },
        { h2: 'Force closed accounts' },
        {
          p: 'A force closed loan appears in the CBA as fully paid. Open **Force Close Accounts** from the CBA menu. You close loans one by one with **+ Force Close Accounts** (contract code, closure date, closure reason 2 to 4, last payment date and amount), or many at once with **Upload Template**.',
        },
        { fig: '04-force-closed-list' },
        { fig: '04-force-close-upload' },
        {
          bullets: [
            'Leave **Include in CBA** unticked to close the accounts and keep them out of the CBA.',
            'Tick it to update the accounts and keep them in the CBA.',
            'A file with only a **contractCode** column always removes the accounts.',
            'Save large files as CSV first: they load faster.',
          ],
        },
        { note: 'This upload changes live loan records. Check the file before you upload it.' },
      ],
    },
    {
      title: 'Open accounts, credit cards and off balance sheet items',
      blocks: [
        { h2: 'Open accounts' },
        {
          p: 'Open Accounts gives you a workbook of the loans whose contract codes you upload. Use it to check a list of accounts against Credit Analyst.',
        },
        { fig: '05-open-accounts' },
        { h2: 'Credit cards' },
        {
          p: 'Credit cards come from a template, not from T24. Each row of the credit card template becomes a loan account of the customer whose client number is in the first column.',
        },
        { fig: '05-credit-cards' },
        {
          tip: 'The message lists any client numbers that are not in Credit Analyst. Create or import those customers first, then upload their rows again.',
        },
        { h2: 'Off balance sheet items' },
        {
          p: 'Guarantees and letters of credit come in from T24 without a client number. Open **Off Balance Sheet Items** in the green bar, type the client number of each item you know and click **Save Changes**. Items whose client number matches a customer are added to the CBA.',
        },
        { fig: '05-off-balance-items' },
        { tip: 'The bin at the end of a row deletes the item. This cannot be undone.' },
      ],
    },
    {
      title: 'Bounced cheques and fully paid accounts',
      blocks: [
        {
          p: 'Upload the bounced cheques from the bounced cheques template. Each cheque is matched to its customer by the account number. A cheque you upload again replaces the one already saved; it is not added twice.',
        },
        {
          steps: [
            'On the dashboard, click **Upload Bounced Cheques** on the BC card.',
            'Download the template if you do not have it, and fill it in.',
            'Drop the file on the box, or click the box and choose it.',
            'Click **Upload**. The list of bounced cheques opens with the result.',
          ],
        },
        { fig: '06-bc-upload' },
        { fig: '06-bc-uploaded' },
        {
          p: 'Click OK. The new cheque is at the top of the list, with the customer it was matched to, the cheque number, the amount and the bounce date.',
        },
        { h2: 'Fully paid or written-off accounts' },
        {
          p: 'Open **Upload Fully Paid/Written Off** from the CBA menu. The workbook has the columns Contract Code, Amount, Exposure, STATUS, Closure Date, Last Payment Amount, Risk, Arrears Date and Days In Arrears. STATUS 4 means fully paid; any other number means written off. The page has no template link.',
        },
        { fig: '06-fully-paid-upload' },
        { tip: 'Contract codes that are not among the loan accounts are listed in the message and are not changed.' },
      ],
    },
    {
      title: 'Fraud (FRA)',
      blocks: [
        { p: 'Fraud records go to the bureau in the FRA file. Open the FRA card on the dashboard.' },
        { fig: '07-fraud-list' },
        {
          steps: [
            'Click **Register Fraud**.',
            'Search for the customer and click **Select**. The customer\'s details are copied into the form.',
            'Choose the category and incident date, type the amounts and describe what happened.',
            'Click **Save**, then OK.',
          ],
        },
        { fig: '07-fraud-form' },
      ],
    },
    {
      title: 'The institution, branches and PI stakeholders',
      blocks: [
        {
          p: 'The PI, PIS and IB files come from these pages. Keep them up to date before you build the files.',
        },
        { fig: '08-institution' },
        { h2: 'Branches' },
        { fig: '08-branches' },
        { fig: '08-branch-new' },
        {
          p: '**Transfer Branch Customers** moves every customer and loan of one branch to another, for example when a branch closes. Choose the From and To branches, click **Begin Transfer** and confirm.',
        },
        {
          tip: 'Deleting a branch is a request. A checker approves or declines it on the Requests page; until then the branch shows a red flag.',
        },
        { h2: 'PI stakeholders' },
        {
          p: 'Add a stakeholder of the bank from a customer already in Credit Analyst, or from a new profile. Type the share percentage and choose the category, then click **Save**.',
        },
        { fig: '08-pis' },
      ],
    },
    {
      title: 'Building the CRB files',
      newPage: true,
      blocks: [
        {
          p: 'Open **CRB Reports** on the REPORTS card. The form starts on the month before this one.',
        },
        { fig: '09-crb-reports' },
        {
          steps: [
            'Choose the report type.',
            'Choose the From and To dates (the form hides the dates a file does not use).',
            'For CMC, tick the instruments of claim option only if the bureau asks for codes instead of text.',
            'Click **Download Report**. The file is saved to your downloads folder.',
          ],
        },
        { h2: 'The CBA file' },
        {
          p: 'The CBA is heavy, so it is built in the background. You can keep working while it runs. Only one CBA run can be active at a time.',
        },
        { fig: '09-cba-form' },
        { fig: '09-cba-queued' },
        {
          p: 'The run has two parts: the generation, then the cleanup. The cleanup row holds the file. When it shows **Completed**, click **Download**.',
        },
        { fig: '09-processes-download' },
        {
          tip: '**Download Short CBA** writes the file from the CBA table as it is now, without building it again. Use it after you have corrected the CBA with the fix tools.',
        },
        {
          note: 'You can manage the background processes: Kill stops a stuck run, Mark Complete closes a run you have checked by hand, and Retry runs a failed PR4 update again. Use them only when you are sure.',
        },
      ],
    },
    {
      title: 'Output files and bureau feedback',
      blocks: [
        {
          p: 'Output Files, in the green bar, keeps the files of a submission for 15 days. Click the arrow on a row to download a file again; an expired file shows in red and cannot be downloaded.',
        },
        {
          p: 'When the bureau sends a file back with rejected records, upload it here to get the affected records as a workbook.',
        },
        { fig: '10-feedback-upload' },
        { fig: '10-output-files' },
        {
          p: '**Convert Excel To CRB CSV File** turns a corrected Excel sheet into the bureau\'s CSV format. Choose the version, choose the file and click **Convert to CSV**.',
        },
      ],
    },
    {
      title: 'Checks before you submit',
      blocks: [
        { h2: 'Loans without CMC, CCG or BS' },
        {
          p: 'Open it from the REPORTS menu. It lists running loans that have no collateral, and company loans with no guarantor or stakeholder. A loan that lacks several things is listed once, with the first thing it lacks. The list is rebuilt by a job, so a loan you have just fixed can stay on it until the next run.',
        },
        { fig: '11-loans-without' },
        { h2: 'Submission analysis' },
        {
          p: 'The submission analysis counts what the files hold: stakeholders, bounced cheques, credit applications and CBA accounts, by currency, branch, product, status and risk, with the largest accounts and the worst by days in arrears.',
        },
        { fig: '12-submission-analysis' },
      ],
    },
    {
      title: 'PR4 upload and analysis',
      blocks: [
        {
          p: 'The PR4 report is the bank\'s loan book from T24. Uploading it updates the loan accounts; analysing it compares it with the CBA so you can see what is missing or different. Generate the CBA first.',
        },
        { fig: '13-pr4-form' },
        {
          bullets: [
            '**UPDATE CBA REPORT** uploads the PR4 file and updates the loan accounts.',
            '**ANALYZE PR4 AGAINST CBA** does that and then compares the file with the CBA.',
            'Save the PR4 workbook as CSV before you upload it: it is processed faster.',
          ],
        },
        { fig: '13-pr4-results' },
        { tip: 'Click **View Previous Analysis** on the Analysis page to open the last results again.' },
      ],
    },
    {
      title: 'Correcting the CBA',
      blocks: [
        {
          p: '**Update CBA Accounts** (CBA menu) shows the CBA table like a spreadsheet. Load an account, change the cells and click **Save Changes**. The CBA Validations box counts the accounts that break each rule; **View** lists them and **Fix** corrects the rules that can be fixed automatically.',
        },
        { fig: '14-update-cba-accounts' },
        { fig: '14-download-short-cba' },
        { h2: 'Fix CBA issues' },
        {
          p: '**Fix CBA Issues** (CBA menu) corrects many records from a file. Each tab has its template and runs in the background.',
        },
        { fig: '14-fix-delete' },
        { note: 'Delete Records removes each listed account from the CBA and closes it as fully paid. It cannot be undone.' },
        { fig: '14-fix-customer' },
        {
          tip: 'Leave dob, nin or gender empty to keep what is there. A date of birth that is not a real date, or a gender other than 0 or 1, is skipped.',
        },
      ],
    },
  ],
  emails: [
    'Credit Analyst sends very few e-mails, and none to you by default.',
    '**Submission Analysis Report**: the submission analysis, mailed on a schedule, but only when IT has switched the job on and put your address on its list. Ask IT if you want it.',
    '**Loans Without CMC, CCG AND BS Report**: the list of loans without collateral, guarantor or stakeholder as a workbook, on the same terms.',
    'When an unexpected error shows a reference and you click **Notify IT**, the e-mail goes to IT with the reference and your note. You do not get a copy.',
  ],
  messages: [
    { text: 'Loan Account Written Off Successfully', what: 'The loan is written off. Click OK. It is now on the Written-off Credit Accounts list.' },
    { text: 'The written off amt must be a number.', what: 'Type the amount in figures only, then click Write Off Loan again.' },
    { text: 'Account(s) Ignored Successfully!', what: 'The loans are on the ignored list and stay out of the CBA. Click OK.' },
    { text: 'Please enter at least one contract code', what: 'Type one or more contract codes, separated by commas.' },
    { text: 'Loan removed from the ignored accounts successfully!', what: 'The loan will be in the next CBA.' },
    { text: 'You are about to force close loan accounts. These accounts will appear in the CBA as fully paid. Proceed?', what: 'Check the rows, then click Yes, Proceed.' },
    { text: 'Loan Accounts Force Closed Successfully!', what: 'The loans are closed and listed on the force closed page.' },
    { text: 'Please choose a file to upload.', what: 'Choose the file first, then click the upload button again.' },
    { text: 'Please choose the open accounts template first.', what: 'Drop the filled template on the box, then click GENERATE REPORT.' },
    { text: 'No file uploaded. Please upload a Credit Cards Template!', what: 'Choose the filled credit card template, then click UPLOAD.' },
    { text: 'Invalid Credit Card Template! Please download the Credit Cards Template, populate it and try again!', what: 'The file is not the credit card template. Download the template, copy your rows into it and upload again.' },
    { text: 'Please fill in a client number for at least 1 off balance sheet item and try again!', what: 'Type a client number in at least one row, then click Save Changes.' },
    { text: 'No file uploaded. Please upload a Bounced Cheques Template!', what: 'Choose the filled template, then click Upload.' },
    { text: 'Invalid Bounced Cheques Template! Please download the Bounced Cheques Template, populate it and try again!', what: 'The file is not the bounced cheques template. Download the template, copy your rows into it and upload again.' },
    { text: 'No file uploaded. Please upload a Fully Paid Template!', what: 'Choose the filled workbook, then click Upload.' },
    { text: 'FRA Saved Successfully', what: 'The record is saved and goes in the next FRA file. Click OK.' },
    { text: 'Institution details Saved Successfully', what: 'The details go in the next PI file.' },
    { text: 'Kindly check inputs with a red border and fill in appropriately!', what: 'Fill in or correct each box with a red border, then save again.' },
    { text: 'Branch Created Successfully', what: 'The branch is on the list and goes in the next IB file.' },
    { text: 'Customers transferred successfully!', what: 'The customers and their loans now belong to the new branch.' },
    { text: 'PIS Saved Successfully', what: 'The stakeholder is on the list and goes in the next PIS file.' },
    { text: 'Request to Delete the Record has been submitted successfully!', what: 'A checker now approves or declines the deletion on the Requests page.' },
    { text: 'The report has been generated.', what: 'The CB011 file is in your downloads folder. Check it before you send it to the bureau.' },
    { text: 'Please choose a valid To date.', what: 'The date does not exist (for example 31 February). Choose another day.' },
    { text: 'CBA report generation has been queued and is running in the background.', what: 'Click View Progress. Download the file from Background Processes when it shows Completed.' },
    { text: 'A CBA generation or cleanup is already running.', what: 'Wait for the run on Background Processes to finish, then ask again.' },
    { text: 'A CBA generation, cleanup or fix is running. Try again when it has finished.', what: 'BS, CCG, CMC and the CBA fixes wait for the CBA run. Try again when Background Processes shows it Completed.' },
    { text: 'Please enter the rule name.', what: 'Type the rule name from the bureau feedback, for example CBA_399 (letters, digits, dashes and underscores, up to 20).' },
    { text: 'The file is no longer available.', what: 'The file is older than 15 days and was removed. Build it again.' },
    { text: 'Please enter a valid exchange rate greater than 0!', what: 'Type the USD to UGX rate of the reporting month end.' },
    { text: 'Submission date must be the last day of a month (e.g. 31 Mar, 30 Apr).', what: 'Choose the last day of the reporting month.' },
    { text: 'Please make sure the PR4 file is attached!', what: 'Drop the PR4 file on the box, then click the button again.' },
    { text: 'PR4 file queued for background processing.', what: 'Click View Background Process and wait until it shows Completed.' },
    { text: 'Another PR4 upload is still being processed. Try again when it has finished.', what: 'Wait for the PR4 process on Background Processes to finish.' },
    { text: 'Please enter an account reference or client number of the loan.', what: 'Type a reference or client number, then click Load Account.' },
    { text: 'No data found for the account number.', what: 'The account is not in the CBA table. Check the number, or generate the CBA again.' },
    { text: 'Invalid input. Please enter digits only.', what: 'That column takes numbers only. Correct the cell before you save.' },
    { text: 'Delete job queued. Track progress in Background Processes.', what: 'Click View Background Process and check that it completes.' },
    { text: 'Process marked as complete.', what: 'The process is closed. Use it only for work you have checked.' },
  ],
}
