// CBS Query Validator Guide (database administrator and reviewer). Figures come from e2e/guide/dba.guide.ts (guide-out/dba/<id>.png).
export default {
  role: 'dba',
  kicker: 'KCB Uganda · Credit Analyst 3.0',
  title: 'CBS Query Validator Guide',
  subtitle: 'Core banking queries: write, review and activate',
  purpose:
    'The database administrator writes and activates the SQL Credit Analyst uses to read T24, and a credit analyst reviews it, so a wrong or missing column never breaks an extract.',
  appliesTo: 'Credit Analyst 3.0 (Java/Vue), release under UAT, November 2026',
  audience: 'Database administrators (DBAs) who maintain the core banking queries, and the credit analysts who review them',
  sections: [
    {
      title: 'Your part in the process',
      blocks: [
        {
          p: 'Every night Credit Analyst reads customers, loans, balances, repayments, overdrafts, guarantees, letters of credit and the PR4 loan book from the core banking system (CBS). Each of these 14 reads is a **module** with its own SQL query. Credit Analyst reads the result by column name, so every column must carry the alias the module expects.',
        },
        {
          p: 'The queries are kept in Credit Analyst, in numbered versions. Only one version of each module is active; the extractors read that one. A new version goes through these steps:',
        },
        {
          table: {
            head: ['Step', 'Who', 'Status afterwards'],
            rows: [
              ['Start a draft from the active version (or a sample) and edit it', 'Database administrator', 'Draft'],
              ['Submit it: Credit Analyst checks it against the module', 'Database administrator', 'Validated, or Validation failed'],
              ['Review it: approve, or recommend changes', 'Reviewer (credit analyst)', 'Approved, or Changes recommended'],
              ['Revise it after a recommendation: a new draft with the text copied', 'Database administrator', 'Draft (a new version)'],
              ['Activate the approved version', 'Database administrator', 'Active; the old one becomes Superseded'],
            ],
            widths: [4600, 2400, 2600],
          },
        },
        {
          note: 'The person who created or submitted a version may not review it. Changing queries needs both the Manage CBS Queries permission and the Database Administrator role; reviewing needs Review CBS Queries.',
        },
        {
          p: 'KCB Uganda runs T24. The Finacle queries are stored too, but the extractors do not read them.',
        },
      ],
    },
    {
      title: 'Getting started',
      blocks: [
        {
          p: 'Sign in with your KCB user ID or e-mail and your password. Click **CBS Query Configuration** in the menu bar. Three tabs sit under the title: **Overview**, **Sample library** and **Events**.',
        },
        { fig: '01-overview' },
        {
          p: 'Click **Open active** on a module to see the query the extractors read now, who activated it and its full history.',
        },
        { fig: '01-active-version' },
      ],
    },
    {
      title: 'Writing a new version (database administrator)',
      blocks: [
        {
          steps: [
            'On the overview, click **Start draft** on the module. The draft starts with the text of the active version.',
            'Edit the SQL. The live check runs a moment after you stop typing.',
            'Fix every finding, using **Apply suggestion** where it is offered.',
            'Type a note that says what you changed.',
            'Click **Save draft** to keep your work, and **Submit** when it is ready.',
          ],
        },
        { fig: '02-editor' },
        {
          p: 'The **Expected columns** list on the right shows each column the module needs: a tick when the query gives it, a cross when it does not. Columns marked **required** must be there.',
        },
        { h2: 'The live check' },
        { fig: '02-finding' },
        {
          table: {
            head: ['Finding', 'What it means'],
            rows: [
              ['MISSING_ALIAS', 'A column has no AS alias. Add AS and the alias shown.'],
              ['WRONG_ALIAS', 'The alias is not one the module reads. The finding names the right one.'],
              ['MISSING_COLUMN', 'An expected column is not in the query (an error when it is required).'],
              ['DUPLICATE_ALIAS', 'Two columns have the same alias.'],
              ['EXTRA_COLUMN', 'A column the module does not read. A warning only.'],
              ['BIND_COUNT', 'The number of ? placeholders differs from what the module passes.'],
              ['STAR_SELECT', 'SELECT * cannot be checked. List the columns.'],
              ['NOT_SELECT, FORBIDDEN_KEYWORD, MULTIPLE_STATEMENTS', 'Only one SELECT (or WITH) query is allowed: no INSERT, UPDATE, DELETE or other statements.'],
              ['TRAILING_SEMICOLON', 'Remove the ; at the end. A warning.'],
              ['PARSE_ERROR', 'Brackets or quotes do not match, or there is no FROM.'],
            ],
            widths: [3000, 6600],
          },
        },
        { fig: '02-ready' },
        {
          tip: 'You can submit a query that still has errors. It is then stored as **Validation failed**; edit it and submit the same version again.',
        },
        { fig: '02-validated' },
        { h2: "A module's versions" },
        {
          p: 'The overview shows the active version of each module and, while one is being worked on, a link to the newest version in progress. Each version page links to the version it was based on, and the Events tab lists every version of a module with what happened to it.',
        },
        { fig: '02-module-versions' },
      ],
    },
    {
      title: 'You cannot review your own version',
      blocks: [
        {
          p: 'A Database Administrator may also hold the review permission, but never for a version they created or submitted. The review page then shows the message below instead of the form.',
        },
        { fig: '03-self-review' },
      ],
    },
    {
      title: 'Reviewing a version (reviewer)',
      blocks: [
        {
          p: 'A version waiting for you shows **Validated**. Open it from the overview (Latest in progress) and click **Review**.',
        },
        { fig: '04-reviewer-version' },
        {
          p: 'The review page shows the query read only, the latest check with its findings, the columns the module needs and the earlier reviews.',
        },
        { fig: '04-review-page' },
        {
          steps: [
            'Choose **Approve** or **Recommend changes**.',
            'Type a comment.',
            'For changes, type one recommendation per line; click **Add recommendation** for another line.',
            'Click **Save review**.',
          ],
        },
        { fig: '04-recommend-changes' },
        { fig: '04-changes-recommended' },
        {
          tip: 'An approval holds for exactly the text you saw. If the text changes, it is a new version and needs a new review.',
        },
      ],
    },
    {
      title: 'Revising, approving and activating',
      blocks: [
        { h2: 'Revise (database administrator)' },
        {
          p: 'Open the version with **Changes recommended** and click **Revise (new draft)**. The new draft starts with the same text and remembers the recommendations it answers. Make the changes and submit it.',
        },
        { fig: '05-revise' },
        { h2: 'Approve (reviewer)' },
        { fig: '06-approve' },
        { h2: 'Activate (database administrator)' },
        {
          p: 'Open the approved version and click **Activate**. Credit Analyst checks the query again against the module; the extractors read it from their next run, and the version that was active becomes **Superseded**.',
        },
        { fig: '07-activate' },
        { fig: '07-active' },
        {
          tip: 'To roll back, open the superseded version that was active before and click **Activate**.',
        },
      ],
    },
    {
      title: 'The sample library and the events',
      blocks: [
        {
          p: 'A sample is a version that has run as the active query, so it is known to work. Start a draft from it with **Use as draft**. A version that has been active can be added with **Promote to sample**.',
        },
        { fig: '08-samples' },
        {
          p: 'The Events tab is the audit trail: every version created, edited, submitted, reviewed, revised, activated or superseded, with who did it and when.',
        },
        { fig: '09-events' },
      ],
    },
  ],
  emails: [
    'Credit Analyst sends no e-mails about the CBS queries. Watch the overview and the Events tab, and tell the reviewer or the database administrator when a version is waiting for them.',
  ],
  messages: [
    { text: 'Draft saved.', what: 'Your text and note are kept. You can come back to the draft later from the overview.' },
    { text: 'Submitted. The query passed validation and waits for review.', what: 'Nothing more to do until a reviewer has looked at it. The text cannot be changed now.' },
    { text: 'Submitted. The query failed validation: see the stored result.', what: 'Read the findings, fix the query and submit the same version again.' },
    { text: 'Submit with errors?', what: 'The live check still finds errors. Cancel and fix them, or submit to store the version as Validation failed.' },
    { text: 'That suggestion no longer fits the text. It will update when the check has run again.', what: 'Wait a moment for the check to run on the new text, then try again.' },
    { text: 'The check is not available right now. You can still save and submit.', what: 'Save your draft. The check runs again on Submit.' },
    { text: 'You have unsaved changes. Leave this page and lose them?', what: 'Click Cancel and then Save draft if you want to keep your changes.' },
    { text: 'Version … of this module is still in progress. Start another draft?', what: 'Open the version in progress from the overview instead, unless you really need a second draft.' },
    { text: 'Only a Database Administrator can change CBS queries. Your account is not in that role.', what: 'Ask the administrator to give your account the Database Administrator role, or ask a DBA to make the change.' },
    { text: 'You created or submitted this version, so you cannot review it. Another analyst has to.', what: 'Ask another reviewer to review the version.' },
    { text: 'Choose an outcome: approve the query or recommend changes.', what: 'Choose Approve or Recommend changes, then click Save review.' },
    { text: 'Add at least one recommendation for the changes.', what: 'Type what should change in a recommendation line, then click Save review.' },
    { text: 'Approving stays valid for exactly this text. The Database Administrator can then activate it. Approve this query?', what: 'Click Yes, approve if the query is right.' },
    { text: 'Changes recommended.', what: 'The Database Administrator sees your recommendations on the version and revises it.' },
    { text: 'Query approved.', what: 'The Database Administrator can now activate the version.' },
    { text: 'New draft created.', what: 'Make the recommended changes in the new draft and submit it.' },
    { text: 'Version activated.', what: 'The extractors read this version from their next run. The version that was active before is now superseded.' },
    { text: 'Version … is … and cannot be activated.', what: 'Only an approved version (or a superseded one that was approved) can be activated. Have it reviewed first.' },
  ],
}
