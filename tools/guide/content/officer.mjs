// Credit Officer Guide. Figures come from e2e/guide/officer.guide.ts (guide-out/officer/<id>.png); facts from the code and
// the UAT script (kcb.creditanalyst.backend/docs/uat/uat-script.md). Every name and number in the pictures is made-up test data.
export default {
  role: 'officer',
  kicker: 'KCB Uganda · Credit Analyst 3.0',
  title: 'Credit Officer Guide',
  subtitle: 'Customer profiles and credit applications',
  purpose:
    'You keep borrower profiles up to date, capture credit applications (CAPs) with their collateral, guarantors and stakeholders, and ask for wrong records to be deleted.',
  appliesTo: 'Credit Analyst 3.0 (Java/Vue), release under UAT, November 2026',
  audience:
    'Credit officers and branch staff who capture profiles and credit applications (the “maker” in the maker-checker process).',
  sections: [
    {
      title: 'Your part in the process',
      blocks: [
        {
          p: 'A credit application moves through three people. You, the credit officer, capture it and its securities. An approver approves or rejects it. Records that were captured by mistake are not deleted by you: you ask for the deletion, and a checker decides.',
        },
        {
          p: 'Everything you capture feeds the CRB files the bank submits, so the details must be complete and correct. The system checks the format of each field, but only you can check that the values are true.',
        },
        {
          table: {
            head: ['Status', 'How it comes about', 'What you do'],
            rows: [
              [
                'Pending',
                'You save a new CAP (single, joint or for a non-existing customer).',
                'Add the collateral, guarantors and stakeholders. Edit the CAP if anything changes. Wait for the approver.',
              ],
              [
                'Approved',
                'An approver approves the CAP, one at a time or in a bulk list.',
                'Nothing. An approved CAP and its securities can no longer be changed.',
              ],
              [
                'Rejected',
                'An approver refuses the CAP and records a reason. The list shows every refusal status (rejected by bank, withdrawn by customer, cancelled) as Rejected.',
                'Nothing in the system. If the customer applies again, capture a new CAP.',
              ],
              [
                'Red flag (deletion requested)',
                'You asked for a record to be deleted.',
                'Wait. A checker approves (the record goes) or declines (the record stays) on the Requests page.',
              ],
            ],
          },
        },
      ],
    },
    {
      title: 'Getting started',
      blocks: [
        { h2: 'Sign in' },
        {
          p: 'Open Credit Analyst in your browser. Without a session the address takes you to the login screen.',
        },
        { fig: '01-login' },
        {
          steps: [
            'Type your KCB user ID or e-mail.',
            'Type your password.',
            'Click Login. Your dashboard opens and greets you by name.',
          ],
        },
        {
          tip: 'After repeated wrong passwords the system makes you wait a few minutes before you can try again. If your account is disabled, ask your administrator.',
        },
        { h2: 'Your dashboard' },
        {
          p: 'The dashboard has one card for each part of the work. The cards you use most are CAP (credit applications), CMC (collateral), CCG (guarantors) and BS (stakeholders). Click the title of a card, or the link at its foot, to open its list. The arrow at the foot of a card opens more choices.',
        },
        { fig: '02-dashboard' },
        {
          tip: 'You also see cards for work other teams do, such as CBA, BC, Institution, PIS and FRA. If you open a page your account has no permission for, you see “You don’t have access to this page”. Ask your administrator if you need it.',
        },
        { h2: 'The top bar' },
        {
          p: 'The navy bar and the green bar under it are on every page. The search box finds customers and CAPs from anywhere. Profiles opens the borrower list. Requests shows your deletion requests. The red icon at the right logs you out.',
        },
        { fig: '03-top-bar' },
        { fig: '04-global-search' },
        {
          tip: 'In the top search, type at least two words of a person’s name (for example the surname and the first name). A single word looks up numbers and company names only. The Profiles page finds a person by one word.',
        },
        {
          p: 'Log out when you leave your desk. If you leave the system idle for about two hours, or your session ends for another reason, the next click shows “Your session has expired or you are not logged in. Please log in to continue.” Click OK, sign in again, and you are taken back to the page you were on.',
        },
      ],
    },
    {
      title: 'Borrower profiles',
      blocks: [
        { h2: 'Find a borrower' },
        {
          p: 'Click Profiles in the green bar. Type a name, a client number or an FCS number in the search box. The list filters as you type.',
        },
        { fig: '05-profiles-search-name' },
        { fig: '06-profiles-search-number' },
        { h2: 'The profile page' },
        {
          p: 'Click the borrower’s name to open the profile. From here you start a new CAP or correct the borrower’s details.',
        },
        { fig: '07-profile-page' },
        { h2: 'Update a profile' },
        {
          steps: [
            'On the profile page click Edit Profile.',
            'Change the details that are out of date. The boxes show what is on record.',
            'Click Save at the bottom of the form. A green message confirms the save.',
          ],
        },
        { fig: '08-profile-edit' },
        { fig: '09-profile-saved' },
        {
          p: 'If a required box is empty or wrong, it is outlined in red and nothing is saved. Fill it in and click Save again.',
        },
        { fig: '10-profile-red-border' },
        {
          tip: 'Changing the classification (Individual or Non Individual) asks you to confirm first, because the customer’s details are swapped for the other kind.',
        },
        { h2: 'Find a client in T24' },
        {
          p: 'If a bank customer is not in the Profiles list, click Import from T24 on the Profiles page. Type the client number or the account number and click Find. When the client is found, the profile is shown with a New Loan button that starts a CAP for the client.',
        },
        { fig: '11-find-in-t24' },
        {
          p: 'For now the search only finds clients who are already in the T24 extract that Credit Analyst holds. The live link to the T24 data warehouse is not connected yet, so a client who is not in the extract is reported as not found.',
        },
        { fig: '12-find-in-t24-not-found' },
      ],
    },
    {
      title: 'Capture a credit application (CAP)',
      blocks: [
        {
          steps: [
            'Open the borrower’s profile and click + New Cap.',
            'Under Loan Details fill in the application date, the currency and amount, the loan type, the term with Month(s) or Year(s), the loan purpose and the branch.',
            'Under Review/Edit Borrower Details check the borrower’s details. What you change here is saved to the profile as well.',
            'Click Proceed.',
            'Click OK on the message. The application page opens.',
          ],
        },
        { fig: '13-new-cap-form' },
        { fig: '14-new-cap-proceed' },
        { fig: '15-new-cap-created' },
        {
          tip: 'The account number (Ac/No) at the top is locked against slips: click it three times to change it. Tick “Is a Joint Application?” or “Is a Restructured Loan Application?” when they apply and fill in the account number that appears.',
        },
        { h2: 'The application page' },
        {
          p: 'The application page (Loan Details) shows the borrower, the amount, the CAP reference (KCB/CAP/…), the dates, the term and the status. A new CAP is Pending. Show / Hide opens every detail of the loan.',
        },
        { fig: '16-application-page' },
        { h2: 'When a CAP is refused' },
        {
          p: 'The system refuses a CAP with the same date, amount, currency and loan type as one the borrower already has. The message names the CAP that exists. Nothing is saved.',
        },
        { fig: '17-new-cap-duplicate' },
        {
          p: 'Empty mandatory boxes are outlined in red, and a message at the bottom left asks you to fill them in.',
        },
        { fig: '18-new-cap-red-border' },
      ],
    },
    {
      title: 'Collateral, guarantors and stakeholders on a CAP',
      blocks: [
        {
          p: 'Add the securities from the application page while the CAP is Pending. Once a CAP is approved or rejected, the buttons are greyed out and the securities can no longer change.',
        },
        { fig: '19-application-actions' },
        { h2: 'Add collateral' },
        {
          steps: [
            'Click Add Collateral.',
            'Choose the type and the currency.',
            'Type the forced sale value and the open market value. Both must be above zero.',
            'Fill in the valuation date, the expiry date, the instrument of claim and a description.',
            'Click Save.',
          ],
        },
        { fig: '20-add-collateral' },
        {
          p: 'The collateral is listed under the borrower’s collateral with a reference KCB/CMC/…, ticked to show that it backs this CAP.',
        },
        { fig: '21-collateral-saved' },
        { h2: 'Add a guarantor' },
        {
          p: 'Click Add Guarantors and choose the kind of guarantor. Individual and Non Individual are for guarantors who have no profile yet: you fill in the guarantee and the guarantor’s profile. Existing Customer picks somebody who already has a profile. Existing Stakeholder picks one of the borrower’s stakeholders.',
        },
        { fig: '22-add-guarantor-menu' },
        { fig: '23-guarantor-individual' },
        {
          tip: 'The form checks the FCS number (13 characters), the NIN (14 characters) and the age (16 years or more). A borrower cannot be its own guarantor.',
        },
        { fig: '24-guarantor-non-individual' },
        { fig: '25-guarantor-existing' },
        {
          p: 'For an existing customer the profile is filled in for you and the classification cannot be changed. Fill in the guarantee and click Save Guarantor.',
        },
        { fig: '26-guarantors-listed' },
        { h2: 'Add a stakeholder' },
        {
          p: 'Stakeholders are the owners of a company borrower, so the Add Stakeholder button appears only on the CAP of a company. Choose Individual, Non Individual or Existing Customer, fill in the share and the category, and click Save.',
        },
        { fig: '27-add-stakeholder-menu' },
        { fig: '28-stakeholder-form' },
        { fig: '29-stakeholder-saved' },
        {
          tip: 'The shareholder percentage cannot be more than 100. A stakeholder is linked when it is saved; its box stays ticked and cannot be cleared.',
        },
        { h2: 'Attach and detach existing securities' },
        {
          p: 'The application page lists every collateral and guarantor the borrower already has. A tick means it backs this CAP. Tick a box to attach it, clear the tick to detach it, and confirm with Yes, Proceed. No, cancel leaves it as it was.',
        },
        { fig: '30-attach-boxes' },
        { fig: '31-attach-confirm' },
        { fig: '32-attached' },
        {
          tip: 'Only the borrower’s own securities can be attached. Attaching or detaching does not delete anything.',
        },
      ],
    },
    {
      title: 'The CAP list and editing a pending CAP',
      blocks: [
        {
          p: 'Click Manage Credit Applications on the CAP card. Search by name, client number or CAP reference, and use Filter to show only Pending, Approved, Rejected or Joint applications.',
        },
        { fig: '33-cap-list' },
        {
          p: 'Point at a row to show its buttons. Loan Details opens the application page. The arrow next to it opens Edit Loan and Delete Loan.',
        },
        { fig: '34-cap-row-menu' },
        {
          tip: 'Approve Loan and Reject Loan appear in the arrow menu only for users allowed to approve.',
        },
        { h2: 'Edit a pending CAP' },
        {
          steps: [
            'Choose Edit Loan in the arrow menu, or click Edit on the application page.',
            'Change the loan details or the borrower’s details.',
            'Click Proceed, then OK. The message reads “Application Updated Successfully”.',
          ],
        },
        { fig: '35-edit-cap' },
        { fig: '36-edit-cap-saved' },
        {
          p: 'Only a Pending CAP can be edited. An approved or rejected CAP shows “You can only edit pending applications”.',
        },
      ],
    },
    {
      title: 'Joint applications and non-existing customers',
      blocks: [
        {
          p: 'The arrow at the foot of the CAP card opens the Applications Report, Non Existing Customer and Joint Application. Bulk Approval appears there only for approvers.',
        },
        { fig: '37-cap-card-menu' },
        { h2: 'A CAP for a customer with no profile' },
        {
          steps: [
            'Choose Non Existing Customer.',
            'Choose the classification, type the full name, the NIN and the client number (for a company: business name, trading name, registration number and client number).',
            'Click PROCEED and confirm.',
            'Tick the box to confirm that IT checked that the account does not exist, and click Proceed.',
            'The New CAP form opens. Complete the profile and the loan, then click Proceed.',
          ],
        },
        { fig: '39-non-existing-customer' },
        {
          tip: 'Each NIN can be used for one non-existing customer only. You type the client number yourself; the system does not make one.',
        },
        { h2: 'A joint application' },
        {
          steps: [
            'Choose Joint Application.',
            'Type two words of the first borrower’s name and click the name. Do the same for each other borrower.',
            'Click PROCEED.',
            'Fill in the loan of each borrower and click Proceed.',
          ],
        },
        { fig: '40-joint-application' },
        {
          p: 'Each borrower gets a CAP of their own, and all of them share one joint account number. If any one of them is refused (for example as a duplicate), none is saved.',
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
        { fig: '38-applications-report' },
        {
          tip: 'Some column headings in the file keep the old spellings (for example “amunt”) because the bureau tools expect them.',
        },
      ],
    },
    {
      title: 'The collateral, guarantor and stakeholder lists',
      blocks: [
        {
          p: 'The CMC, CCG and BS cards open the lists of every collateral, guarantor and stakeholder captured, for all borrowers. Search the list, then use the pencil to edit a record. The bin asks for a record to be deleted.',
        },
        { h2: 'Collateral (CMC)' },
        { fig: '41-cmc-list' },
        { fig: '42-cmc-edit' },
        {
          tip: 'Map Instruments Of Claim changes one instrument of claim to another on every collateral that has it, and tells you how many were changed. Use it with care.',
        },
        { h2: 'Guarantors (CCG)' },
        { fig: '43-ccg-list' },
        { fig: '44-ccg-edit' },
        { h2: 'Stakeholders (BS)' },
        { fig: '45-bs-list' },
        { fig: '46-bs-edit' },
      ],
    },
    {
      title: 'Ask for a record to be deleted',
      blocks: [
        {
          p: 'You cannot delete a record yourself. You ask for the deletion and give a reason; a checker approves or declines it. Until then the record stays and shows a red flag.',
        },
        {
          steps: [
            'Find the record in its list and click the bin (on the CAP list: the arrow menu, Delete Loan; on the Profiles list: Delete).',
            'Type the reason in the box. An empty reason is refused.',
            'Click Yes, Proceed!, then OK.',
          ],
        },
        { fig: '47-delete-reason' },
        { fig: '48-delete-submitted' },
        { fig: '49-delete-flag' },
        {
          p: 'Follow your request on the Requests page. It shows Pending Approval and “Waiting for another user to decide” until a checker acts, then moves to Approved or Canceled with the checker’s name and the date.',
        },
        { fig: '50-requests-own' },
        {
          tip: 'Only one request can be open for a record. Nobody can decide their own request, whatever their permissions. If your account also holds Cancel Deletion Requests, you see Decline & Maintain on other users’ requests.',
        },
        {
          p: 'A profile with a single record can only be deleted as a whole profile; the dialog tells you which choices you have.',
        },
      ],
    },
    {
      title: 'If you work in a branch',
      blocks: [
        {
          p: 'Without the permission “View All Credit Applications” the CAP list and its search show only the CAPs you captured yourself. Everything else works as described in this guide.',
        },
        { fig: '51-branch-own-applications' },
      ],
    },
  ],
  emails: [
    'Credit Analyst does not send you e-mails about your profiles, applications or deletion requests. Follow them in the CAP list and on the Requests page.',
    'If something goes wrong, a box “Something went wrong” shows an error reference (ERR-…). Click Notify IT to send the reference to the IT team by e-mail. The e-mail goes to IT, not to you.',
    'The scheduled reports (the daily submission analysis, the loans without CMC, CCG or BS list and the warehouse password reminder) go only to the addresses IT has set up.',
  ],
  messages: [
    {
      text: 'Invalid email address or password!',
      what: 'Check your user ID or e-mail and your password and try again.',
    },
    {
      text: 'Account is disabled. Contact admin',
      what: 'Your account has been disabled. Ask your administrator.',
    },
    {
      text: 'Too many sign-in attempts. Try again in … minutes.',
      what: 'Wait for the time shown, then sign in with the right password.',
    },
    {
      text: 'Your session has expired or you are not logged in. Please log in to continue.',
      what: 'Click OK and sign in again. You are taken back to the page you were on.',
    },
    {
      text: 'You don’t have access to this page',
      what: 'Your account does not have the permission for this page. Ask your administrator if you need it.',
    },
    { text: 'Profile Updated Successfully', what: 'Nothing to do: the changes are saved.' },
    {
      text: 'Kindly check inputs with a red border and fill in appropriately!',
      what: 'Fill in or correct every box outlined in red, then click Save or Proceed again. Nothing was saved.',
    },
    {
      text: 'Failed! Record matching the search "…" does not exist in T24',
      what: 'Check the number. Only clients already in the T24 extract can be found until the warehouse link is connected. Ask the CRB team to add the client.',
    },
    {
      text: 'Application Created Successfully',
      what: 'Click OK. The application page opens; the CAP is Pending.',
    },
    {
      text: 'Application Updated Successfully',
      what: 'Click OK. The application page opens with your changes; the reference and the status stay the same.',
    },
    {
      text: 'Duplicate credit application! The following application(s) with the same date, amount, currency and loan type already exist: … The application was not saved.',
      what: 'Do not capture it again. Open the CAP named in the message; if something has changed, edit that one.',
    },
    {
      text: 'You can only edit pending applications',
      what: 'The CAP has been approved or rejected and can no longer be changed.',
    },
    {
      text: 'Collateral Saved Successfully',
      what: 'Nothing to do: the collateral is saved and attached to the CAP.',
    },
    {
      text: 'Please provide Collateral Forced Sale Value and try again',
      what: 'Type the forced sale value (above zero). The open market value has a message of its own.',
    },
    {
      text: 'Guarantor Saved Successfully',
      what: 'Nothing to do: the guarantor is saved and attached to the CAP.',
    },
    {
      text: 'The FCS Number should be 13 characters in length!',
      what: 'Correct the FCS number to 13 characters.',
    },
    {
      text: 'The County ID (NIN) should be 14 characters in length!',
      what: 'Correct the NIN to 14 characters.',
    },
    {
      text: 'Date Of Birth, must be greater than or equal to 16 years',
      what: 'Check the date of birth; a guarantor or stakeholder must be 16 or older.',
    },
    {
      text: 'A borrower cannot be a guarantor of itself! Please select/capture a different guarantor.',
      what: 'Choose somebody other than the borrower.',
    },
    { text: 'Stakeholder Saved Successfully', what: 'Nothing to do: the stakeholder is saved.' },
    {
      text: 'Share holder Percentage cannot be greater than 100%!',
      what: 'Type a percentage of 100 or less.',
    },
    {
      text: 'Collateral Attached To Loan Successfully',
      what: 'Nothing to do. To undo it, clear the tick and confirm.',
    },
    {
      text: 'Securities can only be changed while the credit application is pending.',
      what: 'The CAP has been decided; its securities can no longer change.',
    },
    {
      text: 'Select at least 2 customers to proceed!',
      what: 'Add a second borrower before you click PROCEED.',
    },
    {
      text: 'The reason for your request to delete this record is required!',
      what: 'Type why the record should be deleted, then click Yes, Proceed! again.',
    },
    {
      text: 'Request to Delete the Record has been submitted successfully!',
      what: 'Nothing is deleted yet. A checker decides on the Requests page; until then the record shows a red flag.',
    },
    {
      text: 'A request to delete this record is already waiting for approval.',
      what: 'Wait for the checker’s decision on the Requests page.',
    },
    {
      text: 'Something went wrong (Error reference: ERR-…)',
      what: 'Click Notify IT so the IT team gets the reference, and tell them what you were doing.',
    },
  ],
}
