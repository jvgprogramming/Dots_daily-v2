---
name: check
description: Verify recent changes by running the right tests, linters and type checks for whichever subprojects (backend/, web/, mobile/) were touched. Use after making code changes or when asked to verify/check work.
---

1. Figure out which subprojects changed: `git status --porcelain` plus any files edited this session. Only check the subprojects that changed, unless `$ARGUMENTS` names one (`backend`, `web`, `mobile`, `all`).

2. Run the checks for each one, from inside its directory:

   **backend/** (Laravel, PHPUnit)
   - `vendor/bin/pint --test` (style check only; on failure, run `vendor/bin/pint` on the changed files)
   - `php artisan config:clear && php -d extension=pdo_sqlite vendor/bin/phpunit` (add `--filter=<TestName>` for a quicker run). Plain `composer test` fails here: XAMPP PHP has no pdo_sqlite.
   - Tests use in-memory SQLite, not MySQL. If they fail with "could not find driver", `pdo_sqlite` is disabled in XAMPP's php.ini. Tell the user; don't change the test config.

   **web/** (Next.js 16)
   - `npm run lint`
   - `npx tsc --noEmit`
   - There are no web tests. Don't run `npm run build` unless the user asks, because it's slow.

   **mobile/** (Flutter)
   - `flutter analyze`
   - `flutter test`. If `flutter` isn't on PATH, say so and skip it.

3. Report results per subproject as pass/fail. For each failure, give the file:line and a one-line cause. If something fails in a file this session didn't touch, say so and don't fix it without asking.
