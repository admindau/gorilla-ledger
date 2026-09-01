# Security policy

## Reporting a vulnerability

Do not open a public issue. Use GitHub private vulnerability reporting for this repository. If that feature is unavailable, contact the repository owner through the private address listed in the production operator records.

Include the affected route or component, reproduction steps, impact, and any proof of concept that does not expose real customer data. We will acknowledge a report within two business days, provide an initial assessment within five business days, and coordinate disclosure after a fix is deployed.

## Supported versions

Only the current production release on the `main` branch is supported. Security fixes are deployed forward; older deployments are not maintained.

## Disclosure and data handling

Please avoid accessing, changing, or retaining personal financial data. Do not run denial-of-service tests or automated scans against production without written authorization. We ask reporters to allow a reasonable remediation window before public disclosure.

## Repository settings required

An owner must enable Dependabot alerts and security updates, CodeQL default or advanced setup, secret scanning and push protection, private vulnerability reporting, and branch protection for `main`. Require the CI, Dependency review, and CodeQL checks, at least one review, resolved conversations, and dismissal of stale approvals after new commits.
