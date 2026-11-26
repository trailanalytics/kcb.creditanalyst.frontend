// Credit Approver Guide. Figures come from e2e/guide/approver.guide.ts (guide-out/approver/<id>.png); facts from the code and
// the UAT script (kcb.creditanalyst.backend/docs/uat/uat-script.md). Every name and number in the pictures is made-up test data.
export default {
  role: 'approver',
  kicker: 'KCB Uganda · Credit Analyst 3.0',
  title: 'Credit Approver Guide',
  subtitle: 'Approving and rejecting credit applications',
  purpose:
    'You decide the credit applications (CAPs) the credit officers capture: you approve them, linking the T24 loan account when it exists, or reject them with a reason, one at a time or as a list.',
  appliesTo: 'Credit Analyst 3.0 (Java/Vue), release under UAT, November 2026',
  audience: 'Credit approvers and managers who hold the permission to approve and reject applications.',
  sections: [
    {
      title: 'Your part in the process',
      blocks: [
        {
          p: 'A credit officer captures each CAP with its collateral, guarantors and stakeholders. It waits as Pending until you decide it. Your decision is final in the system: a decided CAP cannot be edited or decided again, and its securities are frozen.',
        },
        {
          table: {
            head: ['Status', 'How it comes about', 'What you do'],
            rows: [
              [
                'Pending',
                'A credit officer saves a new CAP.',
                'Look at the application and its securities, then approve or reject it.',
              ],
              [
                'Approved',
                'You choose Approved and update the status, alone or in a bulk list.',
                'Nothing more. An approved CAP cannot be changed or decided again.',
              ],
              [
                'Rejected',
                'You choose a refusal status (rejected, rejected by bank, withdrawn by customer, cancelled) and a reason.',
                'Nothing more. The list shows every refusal status as Rejected; the reason is stored with the CAP.',
              ],
            ],
          },
        },
        {
          tip: 'You do not capture or change applications. The officer’s buttons (Edit Loan, Add Collateral, Add Guarantors) may still appear on your screens, but your account is refused if you use them.',
        },
      ],
    },
    {
      title: 'Getting started',
      blocks: [
        {
          steps: [
            'Open Credit Analyst in your browser.',
            'Type your KCB user ID or e-mail and your password, and click Login.',
            'Your dashboard opens.',
          ],
        },
        {
          p: 'Your work starts on the CAP card. Manage Credit Applications opens the list of applications. The arrow at the foot of the card opens Bulk Approval and the Applications Report.',
        },
        { fig: '01-dashboard' },
        {
          p: 'The search box in the top bar finds a customer or a CAP from any page: type two words of a name, a client number, a NIN or a CAP reference. The red icon at the top right logs you out.',
        },
      ],
    },
    {
      title: 'Find the applications waiting for you',
      blocks: [
        {
          steps: [
            'Click Manage Credit Applications on the CAP card.',
            'In Filter choose Pending.',
            'To find one application, type the borrower’s name, the client number or the CAP reference in the search box.',
          ],
        },
        { fig: '02-pending-list' },
        {
          p: 'Point at a row to show its buttons. Loan Details opens the application. The arrow next to it opens Approve Loan and Reject Loan.',
        },
        { fig: '03-row-menu' },
        { h2: 'Look at the application first' },
        {
          p: 'The application page shows the borrower, the amount, the CAP reference, the dates, the term, the loan type, the purpose and the branch. Show / Hide opens every detail of the loan and the borrower. Further down are the borrower’s collateral, guarantors and stakeholders; a tick means it backs this CAP.',
        },
        { fig: '04-application-page' },
      ],
    },
    {
      title: 'Approve an application',
      blocks: [
        {
          steps: [
            'Choose Approve Loan in the row’s arrow menu, or click Change Status on the application page.',
            'In Application Status choose Approved.',
            'If the loan is already booked in T24, type its loan account number. Otherwise leave the box empty.',
            'Check the amount approved and the term.',
            'Click Update Application Status, then OK.',
          ],
        },
        { fig: '05-approve-form' },
        { fig: '06-approved' },
        { fig: '07-approved-in-list' },
        {
          p: 'A loan account number must be one that Credit Analyst holds, and it can approve one application only. A number that is not found, or one that is already used, is refused and the application stays Pending.',
        },
        { fig: '08-loan-not-found' },
        {
          tip: 'The Term box on the Change Status page is labelled “in months” but shows the term as the officer typed it. For a CAP captured in years, check the term before you update.',
        },
      ],
    },
    {
      title: 'Reject an application',
      blocks: [
        {
          steps: [
            'Choose Reject Loan in the row’s arrow menu, or click Change Status on the application page.',
            'In Application Status choose the refusal status that applies.',
            'Choose the rejection reason. A reason is required.',
            'Click Update Application Status, then OK.',
          ],
        },
        { fig: '09-reject-form' },
        { fig: '10-declined' },
        { fig: '11-rejected-in-list' },
      ],
    },
    {
      title: 'Decide many applications at once (bulk approval)',
      blocks: [
        {
          p: 'Bulk approval works on your own list of CAPs. You upload a workbook with the CAP references, decide each one on the screen and save them together. Uploading a new list replaces your previous one.',
        },
        { fig: '12-cap-card-menu' },
        { fig: '13-bulk-approval' },
        { h2: 'Upload the list' },
        {
          steps: [
            'Click Upload New List.',
            'Put the CAP references in the first column of a workbook (.xlsx, .xls or .csv), one per row, under a heading. The template link gives you an example.',
            'Drop the file on the box, or click the box to choose it.',
            'Click UPLOAD, then OK. References that do not exist are named in the message and left out.',
          ],
        },
        { fig: '14-bulk-upload' },
        { fig: '15-bulk-uploaded' },
        {
          tip: 'To build the list, export the pending applications with the Applications Report (status Pending) and copy the CAP references you want to decide.',
        },
        { h2: 'Decide and save' },
        {
          steps: [
            'For each application choose a status. Approved needs the loan account number; a refusal status needs a reason.',
            'Leave a row on Pending to decide it later.',
            'Click SAVE CHANGES, then OK. The message counts the approved and the declined applications.',
          ],
        },
        { fig: '16-bulk-decide' },
        { fig: '17-bulk-saved' },
        {
          p: 'In bulk, an application is approved only with a loan account that exists and is not already used. If a loan account is missing or wrong, or a reason is missing, the application is named in the message and stays Pending. To approve without a loan account, use Change Status on the application instead.',
        },
        {
          p: 'Download List saves your current list, with the details of each application, as an Excel file.',
        },
      ],
    },
    {
      title: 'Export applications to Excel',
      blocks: [
        {
          steps: [
            'Open the arrow menu of the CAP card and choose Applications Report.',
            'Choose the status: All, Pending, Approved or Rejected.',
            'If you need to, choose the application dates and the branch.',
            'Click Download. An Excel file named CB011CAE… is saved to your computer.',
          ],
        },
        { fig: '18-applications-report' },
      ],
    },
    {
      title: 'Auto-approval reviews',
      blocks: [
        {
          p: 'The arrow menu of the CAP card lists Auto-Approval Reviews. That screen is not built yet and is coming in a later release. Until then the page only says so.',
        },
      ],
    },
  ],
  emails: [
    'Credit Analyst does not e-mail you when an application is waiting for you. Check the CAP list with the Pending filter, or upload your list in Bulk Approval.',
    'If something goes wrong, a box “Something went wrong” shows an error reference (ERR-…). Click Notify IT to send the reference to the IT team by e-mail. The e-mail goes to IT, not to you.',
  ],
  messages: [
    {
      text: 'Loan Application Approved Successfully',
      what: 'Click OK. The application is now Approved and can no longer be edited.',
    },
    {
      text: 'Loan account … was not found.',
      what: 'Check the loan account number. If the loan is not booked yet, leave the box empty and approve.',
    },
    {
      text: 'Loan Account … has already been used to approve an application',
      what: 'One loan account approves one application only. Check the number, or leave the box empty.',
    },
    {
      text: 'Declined Successfully',
      what: 'Click OK. The application is rejected and the reason is stored with it.',
    },
    {
      text: 'The rejection reason field is required.',
      what: 'Choose a rejection reason, then click Update Application Status again.',
    },
    {
      text: 'Only pending applications can be approved or declined.',
      what: 'The application has already been decided. Look at its status in the list.',
    },
    {
      text: 'Record Uploaded Successfully. Not found: …',
      what: 'The references named do not exist and were left out. Check them; the others are on your list.',
    },
    {
      text: 'Choose the credit applications template first.',
      what: 'Drop a workbook on the box, or click it to choose one, before you click UPLOAD.',
    },
    {
      text: 'Choose a status for at least one application.',
      what: 'Choose Approved or a refusal status on at least one row before you click SAVE CHANGES.',
    },
    {
      text: 'Saved Successfully: … approved, … declined.',
      what: 'Nothing to do: the counts say how many applications were decided.',
    },
    {
      text: 'Not approved (loan not found, already used or reason missing): …',
      what: 'The applications named were not decided. Give each a loan account that exists and is unused, or a reason, and save again.',
    },
    {
      text: 'You don’t have access to this page',
      what: 'The page needs a permission your account does not have (for example Edit Loan, which is for credit officers).',
    },
    {
      text: 'Your session has expired or you are not logged in. Please log in to continue.',
      what: 'Click OK and sign in again. You are taken back to the page you were on.',
    },
  ],
}
