# DOTS Daily v2 - Project Constitution

Version: 1.0

---

# 1. Project Overview

DOTS Daily v2 is a Tuberculosis Treatment Monitoring System.

The project consists of three independent applications sharing one backend.

- Web Admin Portal (Next.js)
- Mobile Patient Application (Flutter)
- Backend REST API (Laravel)

All applications communicate only through the REST API.

Direct database access from frontend applications is prohibited.

---

# 2. Technology Stack

## Web

- Next.js 15
- App Router
- TypeScript
- Tailwind CSS
- shadcn/ui
- React Hook Form
- Zod
- Axios
- TanStack Query

## Backend

- Laravel 12
- Sanctum
- Eloquent ORM

## Database

- MySQL (Development)
- PostgreSQL (Future)

## Mobile

- Flutter

---

# 3. Folder Structure

DOTS-Daily-v2/

web/

backend/

mobile/

docs/

assets/

Every application must remain independent.

---

# 4. Development Philosophy

Always prioritize

- Readability
- Maintainability
- Scalability
- Security

Never optimize prematurely.

Never sacrifice clean architecture for shorter code.

---

# 5. Coding Standards

Use TypeScript.

No "any" unless absolutely necessary.

Every function should have one responsibility.

Avoid duplicate code.

Prefer reusable components.

Never hardcode values.

Use environment variables.

---

# 6. Architecture Rules

Business logic belongs in Services.

UI components should only render data.

API communication belongs in Services.

Pages should be thin.

Components should be reusable.

Never place API calls directly inside UI components unless justified.

---

# 7. Naming Conventions

Folders

lowercase

Example

users

dashboard

reports

Files

PascalCase

UserTable.tsx

DashboardHeader.tsx

Variables

camelCase

Functions

camelCase

React Components

PascalCase

Interfaces

Prefix with I

Example

IUser

ITreatmentPlan

Enums

PascalCase

Constants

UPPER_CASE

---

# 8. Component Rules

Reusable UI

components/ui/

Feature Components

components/dashboard/

components/forms/

components/tables/

Never duplicate components.

---

# 9. API Rules

All requests must go through Axios.

Create one API client.

Never call fetch() directly.

Never hardcode URLs.

Always use

NEXT_PUBLIC_API_URL

---

# 10. Laravel Rules

Controllers

Thin.

Services

Contain business logic.

Form Requests

Contain validation.

Models

Contain relationships.

Policies

Contain authorization.

Never write business logic inside Controllers.

---

# 11. Database Rules

Use migrations.

Never edit production tables manually.

Use foreign keys.

Always use timestamps.

Use soft deletes where appropriate.

---

# 12. Authentication Rules

Laravel Sanctum.

Password hashing.

Role-based authorization.

No passwords stored in plaintext.

---

# 13. Error Handling

Never expose server errors.

Always return meaningful API responses.

Use consistent JSON.

Example

{
"success": true,
"message": "...",
"data": {}
}

---

# 14. Git Workflow

main

Production-ready

develop

Integration

feature/auth

feature/dashboard

feature/users

feature/ai

Never commit directly to main.

---

# 15. UI Guidelines

Use shadcn/ui.

Minimal.

Accessible.

Responsive.

Consistent spacing.

Consistent typography.

No inline styling.

---

# 16. Security

Validate every request.

Sanitize inputs.

Protect API routes.

Never expose secrets.

Use .env.

Rate limit authentication.

---

# 17. AI Integration

AI providers are replaceable.

Never place AI logic inside controllers.

Create an AI Service.

Controllers only call AI Service.

---

# 18. Documentation

Every module should have

Purpose

API

Dependencies

Future Improvements

---

# 19. Definition of Done

A feature is complete when

✓ UI completed

✓ Backend completed

✓ Database completed

✓ Validation completed

✓ Responsive

✓ API tested

✓ Error handling implemented

✓ Documentation updated

---

# 20. Thesis Principles

The project should demonstrate

Clean Architecture

RESTful APIs

Role-Based Authentication

Secure Coding Practices

Responsive Design

Maintainable Code

Scalable Folder Structure

Proper Documentation

Professional UI/UX

Separation of Concerns

Every implementation should be defendable during the thesis presentation.

If a decision is made, it should have a technical justification.

# AI Collaboration Rules

AI assists development but does not make architectural decisions.

Before generating code, AI must follow the existing architecture and folder structure.

AI must never:

- Rewrite unrelated files.
- Change project architecture without instruction.
- Introduce new libraries without approval.
- Duplicate existing functionality.
- Ignore coding conventions.

When generating code:

- Explain what will be created.
- Keep changes focused on the requested task.
- Preserve existing code unless modification is required.
- Prefer extending existing modules over creating new ones.
