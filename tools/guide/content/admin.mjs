// Administrator Guide. Figures come from e2e/guide/admin.guide.ts (guide-out/admin/<id>.png).
export default {
  role: 'admin',
  kicker: 'KCB Uganda · Credit Analyst 3.0',
  title: 'Administrator Guide',
  subtitle: 'Users, logs, configuration and T24',
  purpose:
    'You give people the right access to Credit Analyst, keep an eye on what they do, look after the T24 connection and the background jobs, and keep the configuration up to date.',
  appliesTo: 'Credit Analyst 3.0 (Java/Vue), release under UAT, November 2026',
  audience: 'System administrators and IT support staff who manage Credit Analyst users and configuration',
  sections: [
    {
      title: 'Your part in the process',
      blocks: [
        {
          p: 'Everyone who uses Credit Analyst needs an account from you. What a person may do is decided only by the permissions you tick on their account. The role decides who may open the admin pages: the **admin** and **crb-officer** roles may, the **crb** role may not.',
        },
        {
          table: {
            head: ['Area', 'What you do', 'Where'],
            rows: [
              ['Users', 'Create accounts, set the permissions, disable and ask for deletion', 'Admin dashboard, Users'],
              ['Logs and statistics', 'See who signed in and what was done; export the logs', 'Admin dashboard, Statistics'],
              ['Configuration', 'The T24 warehouse login and the CRB application charge', 'Admin dashboard, Configurations'],
              ['T24', 'Imports, commands, client number mapping and forex rates', 'Sync T24 in the menu bar'],
              ['Background processes', 'Follow long jobs; kill, mark complete or retry them', 'Background Processes'],
              ['Requests', 'See deletion requests; a checker decides them', 'Requests in the menu bar'],
            ],
            widths: [2000, 4800, 2800],
          },
        },
        {
          note: 'Deleting a user, a branch or any other record is never done by one person. You ask for it, and a checker approves or declines it on the Requests page.',
        },
      ],
    },
    {
      title: 'Getting started',
      blocks: [
        {
          p: 'Sign in with your KCB user ID or e-mail and your password. Click **Admin Dashboard** in the green bar to reach the admin pages. **CRB Dashboard** takes you back.',
        },
        {
          tip: 'After 5 wrong passwords in 15 minutes an account is locked for 15 minutes. A session ends after 120 minutes without use, and after 12 hours in any case.',
        },
      ],
    },
    {
      title: 'Your dashboard',
      blocks: [
        { fig: '01-admin-dashboard' },
        {
          p: 'A **CBS Queries** card also shows for people who manage or review the core banking queries. That work is described in the CBS Query Validator guide.',
        },
      ],
    },
    {
      title: 'Managing users',
      blocks: [
        { fig: '02-users' },
        { h2: 'Create a user' },
        {
          steps: [
            'Click **+ New User**.',
            'Type the first name, last name and e-mail.',
            'Choose the authentication: **Active Directory** for staff who sign in with their KCB network password, or **Credit Analyst (password)** for an account with its own password.',
            'For a Credit Analyst account, type a password that meets the rules below.',
            'Choose the role and, for a branch user, the branch.',
            'Tick the permissions and click **Create User**.',
          ],
        },
        { fig: '02-user-new' },
        { fig: '02-user-permissions' },
        {
          tip: 'A new user starts with the default permission (Search Profiles) ticked. The Admin permissions are not offered for the crb role.',
        },
        { h2: 'Password rules' },
        {
          p: 'A Credit Analyst password needs at least 12 characters, an upper case letter, a lower case letter, a digit and a special character. Easy guesses such as "password", "qwerty", "admin" or "kcb" are refused, and so is a password that contains the e-mail. Active Directory passwords follow the bank\'s own policy and never reach Credit Analyst.',
        },
        { fig: '02-password-rules' },
        { h2: 'Change or disable a user' },
        {
          p: 'Click **Edit** on the user. Change what you need and click **Update User**. Choose **Disabled** under Status to stop someone signing in without deleting the account.',
        },
        { fig: '02-user-edit' },
        { h2: 'Delete a user' },
        {
          p: 'Click the bin on the user and type why. The user keeps working until a checker approves the request; then the account is deleted and signed out for good. The list shows a red flag on a user with a pending request.',
        },
        { fig: '02-user-delete' },
        { fig: '02-requests' },
      ],
    },
    {
      title: 'Logs and statistics',
      blocks: [
        {
          p: 'The activity log lists what users did (for example "created user"), the login log lists every sign-in, and Deleted Records counts the deleted records of each table.',
        },
        { fig: '03-activity-logs' },
        { fig: '03-deleted-records' },
        { h2: 'Export' },
        {
          p: 'Click **Export**, choose the log (login logs, activity logs, deleted records or users), the dates and the format, then click **Download**.',
        },
        { fig: '03-export' },
      ],
    },
    {
      title: 'Configuration',
      blocks: [
        {
          p: 'The **T24 Credentials** tab holds the login Credit Analyst uses for the T24 data warehouse, and the date its password expires. The password is stored encrypted and is never shown again; leave the box empty to keep it.',
        },
        { fig: '04-configuration-t24' },
        { p: 'The **CRB Application Charges** tab holds the CRB suspense account and the amount charged.' },
        { fig: '04-configuration-charges' },
      ],
    },
    {
      title: 'The T24 page',
      newPage: true,
      blocks: [
        {
          p: 'The T24 page shows what came in from T24 and lets you run the extracts by hand. Open it with **Sync T24** in the menu bar.',
        },
        { fig: '05-t24-imports' },
        { h2: 'Run a command' },
        {
          p: 'Each command runs in the background. Run the extracts first and the merges after them: merge-customers before merge-loans, because a loan needs its customer.',
        },
        { fig: '05-t24-commands' },
        { fig: '05-t24-command-started' },
        { h2: 'When the warehouse is not set up' },
        {
          p: 'On a copy of Credit Analyst with no T24 warehouse, a command still starts, then fails on Background Processes with the reason. The T24 Password tab says "No credentials are saved yet.". Saving the login also needs the two encryption keys of the server; without them the save fails. In both cases ask IT to set up the warehouse connection.',
        },
        { fig: '05-t24-password' },
        { h2: 'Map client numbers' },
        {
          p: 'A client created in Credit Analyst before T24 knew them needs their T24 client number. Choose the client and type the number, or tick **Auto Map** to match every waiting client by national ID.',
        },
        { fig: '05-t24-map' },
        { h2: 'Forex rates' },
        {
          p: 'The month-end rates of the last four months. Click a rate to change it in place, or **Add Rate** for a new currency or month end. A rate must be a number above zero.',
        },
        { fig: '05-t24-forex' },
      ],
    },
    {
      title: 'Background processes',
      blocks: [
        {
          p: 'Long jobs (the CBA file, the PR4 upload, the T24 commands and the CBA fixes) run in the background. Everyone sees the jobs they started; you see everyone\'s, with who started them, and you can manage them.',
        },
        { fig: '06-processes' },
        {
          bullets: [
            '**Kill** stops a job that is pending or running and marks it failed. Use it for a job that is stuck.',
            '**Mark Complete** closes a job you have checked by hand. It runs nothing again.',
            '**Retry** is offered for a failed PR4 update only. It starts a new job.',
          ],
        },
        { fig: '06-mark-complete' },
      ],
    },
    {
      title: 'Read-only and audit access',
      blocks: [
        {
          p: 'Auditors and reviewers get an account with the view permissions only. They can open the lists and the detail pages but are not offered the buttons to add, change, approve or delete, and the server refuses those actions too. With the crb role they cannot open the admin pages.',
        },
        { fig: '07-readonly-loans' },
        { fig: '07-readonly-fraud' },
        {
          p: 'Someone who opens a page their account has no permission for sees the page below. Grant the permission on their account if they need it.',
        },
        { fig: '07-noaccess-403' },
      ],
    },
  ],
  emails: [
    'Credit Analyst sends very few e-mails.',
    '**[Credit Analyst] Error report** with a reference: sent when a user clicks Notify IT after an unexpected error. It goes to the IT address set on the server (ERROR_REPORT_EMAILS), with the reference and the user\'s note. Look the reference up in the server log.',
    '**Data Ware House Password Expiry**: a reminder before the saved T24 warehouse password expires. It is sent only when IT has switched the reminder job on and listed the recipients; no one gets it by default.',
    'There is no daily e-mail of the T24 imports in this release. Check the T24 Imports tab instead.',
  ],
  messages: [
    { text: 'User Created Successfully', what: 'The user can sign in now. Give them the password in person or by phone, never by e-mail.' },
    { text: 'A user with the same email account already exists!', what: 'Search the users for that e-mail. Edit the existing account instead of creating a second one.' },
    { text: 'The password must be at least 12 characters.', what: 'Type a longer password with upper and lower case letters, a digit and a special character.' },
    { text: 'The password is too easy to guess.', what: 'Do not use words such as password, admin, kcb or 123456 in the password.' },
    { text: 'The password must not contain the email address.', what: 'Choose a password that has nothing of the e-mail in it.' },
    { text: 'Updated Successfully', what: 'The change applies the next time the user opens a page.' },
    { text: 'Request to Delete the Record has been submitted successfully!', what: 'A checker approves or declines the request on the Requests page. The user is deleted only then.' },
    { text: 'The command has been started. Follow its progress on the Background Processes page.', what: 'Open Background Processes to see whether it completed or failed.' },
    { text: 'The data warehouse connection is not configured: set creditanalyst.warehouse.service (T24_SERVICE), for example host:1521/SERVICE_NAME.', what: 'Credit Analyst has no connection to the T24 warehouse. Ask IT to set the warehouse service and save the warehouse login, then run the command again.' },
    { text: 'Select a command to run.', what: 'Choose a command in the list, then click Run Command.' },
    { text: 'No credentials are saved yet.', what: 'No warehouse login is saved. Type the user name, password and expiry date, and save.' },
    { text: 'Please select a client to map and supply their T24 client number or check auto map and try again.', what: 'Choose a client and type their T24 client number, or tick Auto Map, then click MAP CLIENTS.' },
    { text: 'Changes saved successfully!', what: 'The forex rate is saved.' },
    { text: 'Process marked as complete.', what: 'The process shows as Completed. Nothing was run again.' },
    { text: 'Process killed successfully.', what: 'The process is stopped and shows as failed. Start the work again when the cause is fixed.' },
    { text: "You don't have access to this page", what: 'The account lacks the permission. If the user needs it, tick it on their account (Users, Edit).' },
  ],
}
