// Deletion Checker Guide. Figures come from e2e/guide/checker.guide.ts (guide-out/checker/<id>.png); facts from the code and
// the UAT script (kcb.creditanalyst.backend/docs/uat/uat-script.md). Every name and number in the pictures is made-up test data.
export default {
  role: 'checker',
  kicker: 'KCB Uganda · Credit Analyst 3.0',
  title: 'Deletion Checker Guide',
  subtitle: 'Deciding deletion requests (maker-checker)',
  purpose:
    'You decide the requests other users make to delete records: you approve a request, and the record is removed, or you decline it, and the record stays.',
  appliesTo: 'Credit Analyst 3.0 (Java/Vue), release under UAT, November 2026',
  audience: 'Supervisors and checkers who hold the permissions to approve and cancel deletion requests.',
  sections: [
    {
      title: 'Your part in the process',
      blocks: [
        {
          p: 'Nobody deletes a record in Credit Analyst with one click. The user who wants a record gone (the maker) asks for the deletion and gives a reason. The record stays, marked with a red flag, until a second user (the checker) decides. That is you.',
        },
        {
          p: 'Requests can be made for credit applications (CAPs), collateral, guarantors, stakeholders, customer profiles, PI stakeholders, branches and users, each by somebody who holds the delete permission of that list.',
        },
        {
          table: {
            head: ['Status', 'How it comes about', 'What you do'],
            rows: [
              [
                'Pending Approval',
                'A maker asks for a record to be deleted and gives a reason.',
                'Read the reason, look at the record, then Accept & Delete or Decline & Maintain.',
              ],
              [
                'Request Approved',
                'You (or another checker) click Accept & Delete.',
                'Nothing more. The record is removed from every list.',
              ],
              [
                'Request Canceled',
                'You (or another checker) click Decline & Maintain.',
                'Nothing more. The record stays, and the maker may ask again.',
              ],
            ],
          },
        },
        {
          tip: 'You cannot decide a request you made yourself, whatever your permissions. A checker account usually has no delete buttons at all, so you do not make requests.',
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
            'Click Requests in the green bar.',
          ],
        },
        { fig: '01-dashboard' },
      ],
    },
    {
      title: 'The Requests page',
      blocks: [
        {
          p: 'The page opens on the Pending requests. Each row shows the request number (DDR-…), the record it is about, who asked, when, and the reason. Filter switches between Pending, Approved and Canceled; the search box finds a request by its number or by the record number, inside the filter you chose.',
        },
        { fig: '02-requests' },
        { fig: '03-request-row' },
        { h2: 'Look at the record' },
        {
          p: 'Click View to see the stored values of the record before you decide. Press Esc or close the box to go back.',
        },
        { fig: '04-request-record' },
      ],
    },
    {
      title: 'Approve a request (Accept & Delete)',
      blocks: [
        {
          steps: [
            'Find the request and check the reason and the record.',
            'Click Accept & Delete.',
            'Click Yes, Proceed! to confirm. Cancel leaves the request pending.',
            'Click OK on the message.',
          ],
        },
        { fig: '05-approve-confirm' },
        { fig: '06-request-approved' },
        {
          p: 'The record is removed from its list and from every search. The request moves to Approved, with your name and the date.',
        },
        { fig: '08-approved-filter' },
        {
          tip: 'Approving a request for a whole customer profile removes the customer. Check the record with View first: there is no button to bring a deleted record back.',
        },
      ],
    },
    {
      title: 'Decline a request (Decline & Maintain)',
      blocks: [
        {
          steps: [
            'Find the request.',
            'Click Decline & Maintain.',
            'Click Yes, Proceed! to confirm, then OK.',
          ],
        },
        { fig: '07-decline-confirm' },
        {
          p: 'The record stays as it was and its red flag goes. The request moves to Canceled, with your name and the date. The maker may ask again later.',
        },
      ],
    },
    {
      title: 'What the maker sees',
      blocks: [
        {
          p: 'The maker follows the request on the same Requests page. A declined request shows Request Canceled and “Record retained”; an approved one shows Request Approved and “Record was deleted”, each with the checker’s name and the date.',
        },
        { fig: '09-maker-sees-canceled' },
        { p: 'After an approval the record is no longer found in its list.' },
        { fig: '10-maker-record-gone' },
      ],
    },
    {
      title: 'Rules the system enforces',
      blocks: [
        {
          p: 'The user who made a request cannot approve or decline it. On their own request they see “Waiting for another user to decide” and no buttons, and the server refuses them even if their account holds the checker permissions.',
        },
        { fig: '11-own-request-waiting' },
        {
          p: 'Only one request can be open for a record at a time. If two checkers act on the same request, the second one is told that it has already been actioned, and the list is refreshed.',
        },
      ],
    },
  ],
  emails: [
    'Credit Analyst does not e-mail you when a deletion request is waiting. Open the Requests page during the day to see what is pending.',
    'The maker is not e-mailed about your decision either; they see it on the Requests page.',
    'If something goes wrong, a box “Something went wrong” shows an error reference (ERR-…). Click Notify IT to send the reference to the IT team by e-mail. The e-mail goes to IT, not to you.',
  ],
  messages: [
    {
      text: 'Request Approved Successfully!',
      what: 'Click OK. The record is removed from every list; the request moves to Approved.',
    },
    {
      text: 'Request Canceled Successfully!',
      what: 'Click OK. The record stays; the maker may ask again later.',
    },
    {
      text: 'You are not allowed to action this request!',
      what: 'You made this request, so another user must decide it. This applies whatever your permissions.',
    },
    {
      text: 'This request was not found or has already been actioned.',
      what: 'Another checker has decided it already. Look under Approved or Canceled.',
    },
    {
      text: "You don't have permission to perform this action. Please contact Admin!",
      what: 'Your account lacks the permission for this action (Approve Deletion Requests or Cancel Deletion Requests). Ask your administrator.',
    },
    {
      text: 'Oops, record not found!',
      what: 'The record of the request no longer exists. Decline the request, or ask IT if you are unsure.',
    },
    {
      text: 'You don’t have access to this page',
      what: 'Your account does not have View Deletion Requests. Ask your administrator.',
    },
    {
      text: 'Your session has expired or you are not logged in. Please log in to continue.',
      what: 'Click OK and sign in again. You are taken back to the page you were on.',
    },
  ],
}
