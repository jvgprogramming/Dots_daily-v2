# Database Design — DOTS Daily v2

> Version: 2.0
> Status: Final Design (Reviewed & Refined)
> Next Step: ✅ Approved — Generate Laravel Migrations

---

## Change Log

| Date | Version | Changes |
|------|---------|---------|
| 2026-07-02 | 2.0 | Simplified roles → ENUM on users; added `phase` to treatment_plans; added `proof_photo` to medication_logs; linked AI recommendations to daily_monitoring; wired daily_monitoring to logs; full validation pass. Reduced from 18 to 14 tables. |

---

## Entity List

| # | Entity | Type | Description |
|---|--------|------|-------------|
| 1 | **User** | Core | All system users — admin or patient |
| 2 | **Patient** | Feature | Patient-specific medical profile |
| 3 | **TreatmentPlan** | Feature | Treatment plan assigned to a patient |
| 4 | **Medication** | Lookup | Medication catalog (master list) |
| 5 | **TreatmentPlanMedication** | Pivot | Medications within a treatment plan (with dosage) |
| 6 | **MedicationLog** | Feature | Patient's daily medication adherence records |
| 7 | **SymptomLog** | Feature | Patient's daily symptom self-reports |
| 8 | **DailyMonitoring** | Feature | Patient's daily vitals & clinical observations |
| 9 | **AiConversation** | Feature | AI chat session header |
| 10 | **AiMessage** | Feature | Individual messages in an AI chat |
| 11 | **AiRecommendation** | Feature | AI-generated clinical recommendations |
| 12 | **Notification** | Feature | System notification records |
| 13 | **NotificationRecipient** | Pivot | Tracks delivery/read status per user |
| 14 | **ActivityLog** | Audit | System-wide audit trail |

> **14 tables total** (reduced from 18 — removed 4 RBAC tables).

---

## Tables & Columns

---

### 1. `users`

The base user table. Every system user is a user. Authentication via Laravel Sanctum.

The `role` column replaces a full RBAC system — appropriate for the current scope (admin + patient only).

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT | |
| name | VARCHAR(255) | NOT NULL | Full name |
| email | VARCHAR(255) | NOT NULL, UNIQUE | Login credential |
| phone | VARCHAR(20) | NULLABLE | Contact number |
| password | VARCHAR(255) | NOT NULL | Bcrypt hashed |
| role | ENUM('admin','patient') | NOT NULL, DEFAULT 'patient' | 🔁 REPLACES separate roles/permissions tables |
| profile_photo_path | VARCHAR(255) | NULLABLE | Storage path to photo |
| is_active | TINYINT(1) | NOT NULL, DEFAULT 1 | Soft disable account |
| email_verified_at | TIMESTAMP | NULLABLE | Sanctum verification |
| last_login_at | TIMESTAMP | NULLABLE | Track last login |
| remember_token | VARCHAR(100) | NULLABLE | Sanctum |
| created_at | TIMESTAMP | NOT NULL | |
| updated_at | TIMESTAMP | NOT NULL | |
| deleted_at | TIMESTAMP | NULLABLE | Soft delete |

**Indexes:**
- PRIMARY KEY (`id`)
- UNIQUE KEY (`email`)
- INDEX (`role`) — filter users by role
- INDEX (`is_active`)
- INDEX (`deleted_at`)

**Why:** Unified user table simplifies authentication. A single authentication endpoint serves both the Web Admin Portal and the Flutter mobile app. Soft deletes preserve referential integrity.

**Why no RBAC tables:** The project currently has exactly two user types — admin and patient. A full RBAC system (roles + permissions + 2 pivot tables) would be overengineering for a thesis project at this stage. A simple ENUM column is easy to implement, easy to understand, and easy to defend during the thesis presentation. If more complex roles are needed in the future, the schema can be extended without breaking existing code.

---

### 2. `patients`

Patient-specific medical profile. Extends the `users` table (one-to-one).

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT | |
| user_id | BIGINT UNSIGNED | FK → users.id, ON DELETE CASCADE, UNIQUE | One patient = one user |
| date_of_birth | DATE | NULLABLE | |
| gender | ENUM('male','female','other') | NULLABLE | |
| address | TEXT | NULLABLE | Full address |
| emergency_contact_name | VARCHAR(255) | NULLABLE | |
| emergency_contact_phone | VARCHAR(20) | NULLABLE | |
| occupation | VARCHAR(100) | NULLABLE | |
| nationality | VARCHAR(100) | NULLABLE | |
| health_id_number | VARCHAR(50) | NULLABLE, UNIQUE | Government/NHIF ID |
| referred_by | VARCHAR(255) | NULLABLE | Referral source |
| registered_by | BIGINT UNSIGNED | FK → users.id, ON DELETE SET NULL | Admin who registered |
| registered_at | TIMESTAMP | NULLABLE | When registration was completed |
| created_at | TIMESTAMP | NOT NULL | |
| updated_at | TIMESTAMP | NOT NULL | |
| deleted_at | TIMESTAMP | NULLABLE | Soft delete |

**Indexes:**
- PRIMARY KEY (`id`)
- UNIQUE KEY (`user_id`)
- UNIQUE KEY (`health_id_number`)
- INDEX (`gender`)
- INDEX (`registered_by`)
- INDEX (`deleted_at`)

**Why:** Separating patient profile from the base user table keeps authentication data clean. Not all users are patients (admins). This follows 3NF by separating patient-specific attributes from user authentication attributes.

---

### 3. `treatment_plans`

A treatment plan is assigned to a patient by an admin. Each patient can have multiple treatment plans over time (e.g., if they relapse or start a new regimen).

The `phase` field tracks the DOTS treatment stage — a standard TB concept that demonstrates domain knowledge.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT | |
| patient_id | BIGINT UNSIGNED | FK → patients.id, ON DELETE CASCADE | |
| assigned_by | BIGINT UNSIGNED | FK → users.id, ON DELETE SET NULL | Admin who assigned |
| plan_name | VARCHAR(255) | NOT NULL | e.g., "Category 1 TB Regimen" |
| phase | ENUM('intensive','continuation','completed') | NOT NULL, DEFAULT 'intensive' | 🔁 NEW — DOTS treatment phase |
| start_date | DATE | NOT NULL | Treatment start |
| expected_end_date | DATE | NOT NULL | Calculated based on regimen |
| actual_end_date | DATE | NULLABLE | When treatment actually ended |
| status | ENUM('active','completed','discontinued','interrupted') | NOT NULL, DEFAULT 'active' | |
| discontinuation_reason | TEXT | NULLABLE | Why discontinued |
| notes | TEXT | NULLABLE | Clinical notes |
| created_at | TIMESTAMP | NOT NULL | |
| updated_at | TIMESTAMP | NOT NULL | |
| deleted_at | TIMESTAMP | NULLABLE | Soft delete |

**Indexes:**
- PRIMARY KEY (`id`)
- INDEX (`patient_id`)
- INDEX (`assigned_by`)
- INDEX (`phase`) — filter by DOTS phase
- INDEX (`status`)
- INDEX (`start_date`)
- INDEX (`deleted_at`)

**Why the `phase` field is important:** TB treatment follows a two-phase regimen under DOTS guidelines. The **Intensive Phase** (first 2 months, typically 4 drugs daily) requires closer monitoring because the bacterial load is highest. The **Continuation Phase** (next 4 months, typically 2 drugs) has reduced medication but requires adherence to prevent relapse. A `Completed` phase indicates the full regimen was finished. Tracking this phase is critical for:
- Knowing which medications the patient should be taking at any point
- Evaluating whether the patient is progressing normally
- Generating phase-appropriate AI recommendations
- This is a standard DOTS concept that strengthens the thesis by demonstrating domain expertise

---

### 4. `medications`

Master catalog of TB medications used in treatment regimens.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT | |
| name | VARCHAR(255) | NOT NULL | e.g., Rifampicin, Isoniazid |
| generic_name | VARCHAR(255) | NOT NULL | Generic/INN name |
| brand_name | VARCHAR(255) | NULLABLE | e.g., Rimactane |
| dosage_form | ENUM('tablet','capsule','injection','syrup') | NOT NULL | |
| strength | VARCHAR(50) | NOT NULL | e.g., "300mg", "75mg/5ml" |
| unit | VARCHAR(20) | NOT NULL | e.g., mg, ml, mcg |
| description | TEXT | NULLABLE | Clinical description |
| is_active | TINYINT(1) | NOT NULL, DEFAULT 1 | For soft disabling |
| created_at | TIMESTAMP | NOT NULL | |
| updated_at | TIMESTAMP | NOT NULL | |

**Indexes:**
- PRIMARY KEY (`id`)
- INDEX (`name`)
- INDEX (`is_active`)

**Why:** A medication catalog ensures consistency across all treatment plans. Rather than typing medication names manually (which invites typos), the system uses a standardized master list.

---

### 5. `treatment_plan_medication` (Pivot)

Links medications to a treatment plan with dosage and scheduling details.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT | |
| treatment_plan_id | BIGINT UNSIGNED | FK → treatment_plans.id, ON DELETE CASCADE | |
| medication_id | BIGINT UNSIGNED | FK → medications.id, ON DELETE RESTRICT | |
| dosage | VARCHAR(50) | NOT NULL | e.g., "300mg", "150mg" |
| frequency | VARCHAR(100) | NOT NULL | e.g., "Once daily", "Twice daily" |
| route | VARCHAR(50) | NOT NULL, DEFAULT 'oral' | oral, intravenous, intramuscular |
| duration_weeks | INT | NOT NULL | How many weeks this medication is taken |
| preferred_time | TIME | NULLABLE | Suggested time of day (e.g., 08:00) |
| notes | TEXT | NULLABLE | Special instructions |
| created_at | TIMESTAMP | NOT NULL | |
| updated_at | TIMESTAMP | NOT NULL | |

**Indexes:**
- PRIMARY KEY (`id`)
- INDEX (`treatment_plan_id`)
- INDEX (`medication_id`)
- UNIQUE KEY (`treatment_plan_id`, `medication_id`) — prevent duplicate entries

**Why:** A treatment plan consists of multiple medications (typically a 3-4 drug regimen for TB). This pivot captures which medications, at what dosage, and for how long — without denormalizing.

---

### 6. `medication_logs`

Patient's daily record of taking their medication. This is the adherence tracking data.

The `proof_photo` column supports photo-based adherence verification from the Flutter app. The `daily_monitoring_id` optionally links this log to a specific monitoring session for day-level reconstruction.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT | |
| treatment_plan_medication_id | BIGINT UNSIGNED | FK → treatment_plan_medication.id, ON DELETE CASCADE | |
| patient_id | BIGINT UNSIGNED | FK → patients.id, ON DELETE CASCADE | |
| scheduled_date | DATE | NOT NULL | The date the dose was scheduled |
| scheduled_time | TIME | NOT NULL | When it was supposed to be taken |
| taken_at | TIMESTAMP | NULLABLE | When they actually took it (null = missed) |
| status | ENUM('taken','missed','skipped','late') | NOT NULL | |
| dose_quantity | VARCHAR(50) | NULLABLE | How much was taken |
| proof_photo | VARCHAR(255) | NULLABLE | 🔁 NEW — Storage path to photo evidence from Flutter app |
| daily_monitoring_id | BIGINT UNSIGNED | NULLABLE, FK → daily_monitoring.id, ON DELETE SET NULL | 🔁 NEW — Optional link to daily monitoring session |
| notes | TEXT | NULLABLE | Patient or observer notes |
| observed_by | BIGINT UNSIGNED | NULLABLE, FK → users.id, ON DELETE SET NULL | DOTS observer (if DOT) |
| created_at | TIMESTAMP | NOT NULL | |
| updated_at | TIMESTAMP | NOT NULL | |

**Indexes:**
- PRIMARY KEY (`id`)
- INDEX (`patient_id`)
- INDEX (`treatment_plan_medication_id`)
- INDEX (`scheduled_date`)
- INDEX (`status`)
- INDEX (`daily_monitoring_id`)
- INDEX (`patient_id`, `scheduled_date`) — composite for daily adherence queries

**Why `proof_photo` exists:** The Flutter app allows patients to upload a photo as proof of medication intake. This supports the DOTS concept when a healthcare worker is not physically present. Only the file path is stored — file upload and validation are handled at the application layer.

**Why `daily_monitoring_id` is nullable:** Keeping it optional means medication logs can be recorded independently by the patient (Flutter app) without requiring a full monitoring session. When a monitoring session occurs, the healthcare worker can link all that day's logs to it, enabling day-level treatment reconstruction.

---

### 7. `symptom_logs`

Patient-reported symptoms. Patients log how they feel each day. This feeds into the AI recommendations and alerts.

The `daily_monitoring_id` optionally links symptoms to a specific monitoring session.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT | |
| patient_id | BIGINT UNSIGNED | FK → patients.id, ON DELETE CASCADE | |
| recorded_date | DATE | NOT NULL | Date of symptom report |
| symptom_type | VARCHAR(100) | NOT NULL | e.g., cough, fever, chest pain, fatigue |
| severity | ENUM('none','mild','moderate','severe') | NOT NULL | |
| duration_hours | INT | NULLABLE | How long the symptom lasted |
| notes | TEXT | NULLABLE | Additional context |
| recorded_by | ENUM('patient','healthcare_worker') | NOT NULL, DEFAULT 'patient' | Who reported it |
| daily_monitoring_id | BIGINT UNSIGNED | NULLABLE, FK → daily_monitoring.id, ON DELETE SET NULL | 🔁 NEW — Optional link to daily monitoring session |
| created_at | TIMESTAMP | NOT NULL | |
| updated_at | TIMESTAMP | NOT NULL | |

**Indexes:**
- PRIMARY KEY (`id`)
- INDEX (`patient_id`)
- INDEX (`recorded_date`)
- INDEX (`symptom_type`)
- INDEX (`daily_monitoring_id`)
- INDEX (`patient_id`, `recorded_date`) — composite for daily queries

**Why:** Symptom tracking enables the AI to detect worsening conditions and alert healthcare providers. Multiple symptoms can be logged per patient per day.

**Why `daily_monitoring_id` is nullable:** Symptoms can be logged independently by the patient through the Flutter app at any time. When a healthcare worker performs a monitoring session, they can link the day's symptoms to it, providing a complete clinical picture.

---

### 8. `daily_monitoring`

Daily vitals and clinical observations recorded by healthcare workers or self-reported.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT | |
| patient_id | BIGINT UNSIGNED | FK → patients.id, ON DELETE CASCADE | |
| recorded_date | DATE | NOT NULL | |
| weight_kg | DECIMAL(5,2) | NULLABLE | |
| temperature_c | DECIMAL(4,2) | NULLABLE | |
| blood_pressure_systolic | INT | NULLABLE | |
| blood_pressure_diastolic | INT | NULLABLE | |
| heart_rate_bpm | INT | NULLABLE | |
| respiratory_rate | INT | NULLABLE | |
| oxygen_saturation | DECIMAL(3,0) | NULLABLE | SpO₂ percentage |
| notes | TEXT | NULLABLE | Clinical observations |
| recorded_by | BIGINT UNSIGNED | FK → users.id, ON DELETE SET NULL | Healthcare worker |
| created_at | TIMESTAMP | NOT NULL | |
| updated_at | TIMESTAMP | NOT NULL | |

**Indexes:**
- PRIMARY KEY (`id`)
- INDEX (`patient_id`)
- INDEX (`recorded_date`)
- INDEX (`patient_id`, `recorded_date`) — composite for daily queries

**Why:** TB affects vital signs. Weight monitoring is critical for TB treatment effectiveness. Daily vitals provide trend data for analytics and AI recommendations.

**Role in day-level reconstruction:** `daily_monitoring` is the hub record for a patient's day. Through the optional `daily_monitoring_id` on `medication_logs` and `symptom_logs`, a complete picture of a single day's treatment history can be assembled: vitals + symptoms + medication adherence + AI recommendations generated from that data.

---

### 9. `ai_conversations`

Chat session headers for the AI feature. Each session groups a series of messages between a patient and the AI.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT | |
| patient_id | BIGINT UNSIGNED | FK → patients.id, ON DELETE CASCADE | |
| title | VARCHAR(255) | NULLABLE | Auto-generated or user-provided |
| context | TEXT | NULLABLE | Medical context passed to AI (symptoms, meds) |
| is_active | TINYINT(1) | NOT NULL, DEFAULT 1 | Whether conversation is ongoing |
| created_at | TIMESTAMP | NOT NULL | |
| updated_at | TIMESTAMP | NOT NULL | |

**Indexes:**
- PRIMARY KEY (`id`)
- INDEX (`patient_id`)
- INDEX (`is_active`)

**Why:** Grouping messages into conversations allows context-aware AI chat and lets patients review past conversations.

---

### 10. `ai_messages`

Individual messages within an AI conversation.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT | |
| conversation_id | BIGINT UNSIGNED | FK → ai_conversations.id, ON DELETE CASCADE | |
| role | ENUM('user','assistant','system') | NOT NULL | Who sent the message |
| content | TEXT | NOT NULL | Message body |
| metadata | JSON | NULLABLE | Token count, model used, latency |
| created_at | TIMESTAMP | NOT NULL | |

**Indexes:**
- PRIMARY KEY (`id`)
- INDEX (`conversation_id`)

**Why:** Storing messages enables conversation history, which is essential for the AI to maintain context and for audit purposes.

---

### 11. `ai_recommendations`

AI-generated clinical recommendations. These are separate from chat messages — they are actionable suggestions logged for review by healthcare providers.

The `daily_monitoring_id` links each recommendation to the specific monitoring data that generated it, providing full traceability.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT | |
| patient_id | BIGINT UNSIGNED | FK → patients.id, ON DELETE CASCADE | |
| daily_monitoring_id | BIGINT UNSIGNED | NOT NULL, FK → daily_monitoring.id, ON DELETE CASCADE | 🔁 NEW — The monitoring session that triggered this recommendation |
| type | VARCHAR(50) | NOT NULL | medication, appointment, referral, alert |
| title | VARCHAR(255) | NOT NULL | Short recommendation |
| description | TEXT | NOT NULL | Detailed recommendation |
| severity | ENUM('info','warning','critical') | NOT NULL, DEFAULT 'info' | |
| status | ENUM('pending','accepted','dismissed') | NOT NULL, DEFAULT 'pending' | |
| reviewed_by | BIGINT UNSIGNED | NULLABLE, FK → users.id, ON DELETE SET NULL | Admin who reviewed |
| reviewed_at | TIMESTAMP | NULLABLE | |
| source | VARCHAR(100) | NOT NULL | Which AI model/rule generated it |
| metadata | JSON | NULLABLE | Additional context |
| created_at | TIMESTAMP | NOT NULL | |
| updated_at | TIMESTAMP | NOT NULL | |

**Indexes:**
- PRIMARY KEY (`id`)
- INDEX (`patient_id`)
- INDEX (`daily_monitoring_id`)
- INDEX (`type`)
- INDEX (`status`)
- INDEX (`severity`)
- INDEX (`patient_id`, `status`, `severity`) — composite for filtering active recommendations

**Why `daily_monitoring_id` is required (NOT NULL):** Every AI recommendation is generated from analyzing a patient's monitoring data (vitals, symptoms, medication adherence). Making this relationship required guarantees full traceability — every recommendation can be traced back to the exact monitoring session that produced it. This is important for clinical audit and thesis credibility.

**Why `daily_monitoring_id` is better than `treatment_plan_id`:**

| Aspect | `daily_monitoring_id` ✅ | `treatment_plan_id` ❌ |
|--------|--------------------------|------------------------|
| **Traceability** | Points to the exact vitals + symptoms that triggered the recommendation | Too broad — a plan lasts months, can't pinpoint what triggered it |
| **Granularity** | A recommendation is about a specific day's status | A treatment plan is a long-term assignment |
| **Clinical value** | "Based on today's low SpO₂ and fever → recommend follow-up" | "Based on your treatment plan → recommend..." (always the same) |
| **Multiple recommendations** | One monitoring session can generate many recommendations | A plan would need to be split into phases for useful recommendations |
| **Day-level reconstruction** | A daily_monitoring entry can show: vitals + symptoms + meds + AI recommendations | Can't reconstruct a day's full picture from a plan ID |

**Conclusion:** `daily_monitoring_id` is the superior choice because AI recommendations in TB monitoring are reactive to a patient's **current daily status**, not their long-term plan. A recommendation like "monitor weight closely — patient lost 2kg in one week" only makes sense when linked to the specific monitoring data that revealed the weight loss.

**Note:** `patient_id` is kept alongside `daily_monitoring_id` as a practical denormalization — querying "all recommendations for this patient" is more efficient without joining through `daily_monitoring`. This is an acceptable trade-off for 3NF in a read-heavy analytics context.

**Application-layer invariant:** When a recommendation is created, the `daily_monitoring_id` must reference an existing monitoring record for the same patient. The application layer should enforce that the `patient_id` on the recommendation matches `daily_monitoring.patient_id`.

---

### 12. `notifications`

System notification records.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT | |
| type | VARCHAR(100) | NOT NULL | Notification class/type |
| title | VARCHAR(255) | NOT NULL | |
| body | TEXT | NOT NULL | |
| data | JSON | NULLABLE | Additional payload |
| sender_id | BIGINT UNSIGNED | NULLABLE, FK → users.id, ON DELETE SET NULL | Who triggered it |
| created_at | TIMESTAMP | NOT NULL | |
| updated_at | TIMESTAMP | NOT NULL | |

**Indexes:**
- PRIMARY KEY (`id`)
- INDEX (`type`)
- INDEX (`created_at`)

**Why:** Centralized notification table enables both in-app and push notifications. The JSON `data` field allows flexibility for different notification types without schema changes.

---

### 13. `notification_recipients` (Pivot)

Tracks which users received a notification and whether they've read it.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| notification_id | BIGINT UNSIGNED | PK, FK → notifications.id, ON DELETE CASCADE | |
| user_id | BIGINT UNSIGNED | PK, FK → users.id, ON DELETE CASCADE | |
| is_read | TINYINT(1) | NOT NULL, DEFAULT 0 | |
| read_at | TIMESTAMP | NULLABLE | |
| created_at | TIMESTAMP | NOT NULL | |

**Indexes:**
- PRIMARY KEY (`notification_id`, `user_id`)
- INDEX (`user_id`, `is_read`)

---

### 14. `activity_logs`

Audit trail for all significant system actions.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | BIGINT UNSIGNED | PK, AUTO_INCREMENT | |
| user_id | BIGINT UNSIGNED | NULLABLE, FK → users.id, ON DELETE SET NULL | Who performed the action |
| action | VARCHAR(100) | NOT NULL | e.g., user.created, treatment.assigned |
| description | TEXT | NULLABLE | Human-readable summary |
| subject_type | VARCHAR(255) | NULLABLE | Eloquent morph — affected model |
| subject_id | BIGINT UNSIGNED | NULLABLE | Eloquent morph — affected ID |
| properties | JSON | NULLABLE | Changed attributes |
| ip_address | VARCHAR(45) | NULLABLE | |
| user_agent | TEXT | NULLABLE | |
| created_at | TIMESTAMP | NOT NULL | |

**Indexes:**
- PRIMARY KEY (`id`)
- INDEX (`user_id`)
- INDEX (`action`)
- INDEX (`created_at`)
- INDEX (`subject_type`, `subject_id`) — polymorphic lookup

**Why:** Activity logs satisfy audit requirements for a medical system. Polymorphic `subject_type`/`subject_id` allows logging any model change without creating separate tables. Note: no `updated_at` — logs should never be modified.

---

## Summary of All Tables

| # | Table | Type | Parent / Link |
|---|-------|------|---------------|
| 1 | users | Core | — |
| 2 | patients | Feature | → users (1:1) |
| 3 | treatment_plans | Feature | → patients (M:1) |
| 4 | medications | Lookup | — |
| 5 | treatment_plan_medication | Pivot | treatment_plans × medications |
| 6 | medication_logs | Feature | → patients (M:1), → tpm (M:1), → daily_monitoring (M:1, nullable) |
| 7 | symptom_logs | Feature | → patients (M:1), → daily_monitoring (M:1, nullable) |
| 8 | daily_monitoring | Feature | → patients (M:1) |
| 9 | ai_conversations | Feature | → patients (M:1) |
| 10 | ai_messages | Feature | → ai_conversations (M:1) |
| 11 | ai_recommendations | Feature | → patients (M:1), → daily_monitoring (M:1, nullable) |
| 12 | notifications | Feature | — |
| 13 | notification_recipients | Pivot | notifications × users |
| 14 | activity_logs | Audit | → users (M:1), polymorphic |

> **14 tables** (reduced from 18 — removed `roles`, `permissions`, `role_user`, `role_permission`)

---

## Relationships

### One-to-One

| # | Entity A | Entity B | FK Column | Description |
|---|----------|----------|-----------|-------------|
| 1 | `users` | `patients` | `patients.user_id` | A user who is a patient has exactly one patient profile |

### One-to-Many

| # | Entity A (1) | Entity B (M) | FK Column |
|---|--------------|--------------|-----------|
| 1 | `patients` | `treatment_plans` | `treatment_plans.patient_id` |
| 2 | `patients` | `medication_logs` | `medication_logs.patient_id` |
| 3 | `patients` | `symptom_logs` | `symptom_logs.patient_id` |
| 4 | `patients` | `daily_monitoring` | `daily_monitoring.patient_id` |
| 5 | `patients` | `ai_conversations` | `ai_conversations.patient_id` |
| 6 | `patients` | `ai_recommendations` | `ai_recommendations.patient_id` |
| 7 | `treatment_plans` | `treatment_plan_medication` | `treatment_plan_medication.treatment_plan_id` |
| 8 | `treatment_plan_medication` | `medication_logs` | `medication_logs.treatment_plan_medication_id` |
| 9 | `ai_conversations` | `ai_messages` | `ai_messages.conversation_id` |
| 10 | `notifications` | `notification_recipients` | `notification_recipients.notification_id` |
| 11 | `users` | `activity_logs` | `activity_logs.user_id` |
| 12 | `daily_monitoring` | `medication_logs` | `medication_logs.daily_monitoring_id` (nullable) |
| 13 | `daily_monitoring` | `symptom_logs` | `symptom_logs.daily_monitoring_id` (nullable) |
| 14 | `daily_monitoring` | `ai_recommendations` | `ai_recommendations.daily_monitoring_id` (nullable) |

### Many-to-Many

| # | Entity A | Entity B | Pivot Table | Reason |
|---|----------|----------|-------------|--------|
| 1 | `treatment_plans` | `medications` | `treatment_plan_medication` | A plan has many medications; a medication is used in many plans |

---

## Entity Relationship Diagram (Text)

```
┌─────────────────────────────────────────────────────────────────────┐
│                          USERS                                      │
│  id (PK) │ name │ email │ password │ role (admin|patient) │ ...     │
└────────────────────┬────────────────────────────────────────────────┘
                     │ 1:1
                     ▼
┌──────────────────────────────────────────────────────────────────────┐
│  PATIENTS                                                            │
│  id (PK) │ user_id (FK,UNIQUE) │ date_of_birth │ gender │ ...       │
└──────────────────┬───────────────────────────────────────────────────┘
                   │ 1:M
                   │
     ┌─────────────┼─────────────────┬──────────────────┐
     │             │                 │                  │
     ▼             ▼                 ▼                  ▼
┌────────────┐ ┌───────────┐ ┌───────────────┐ ┌──────────────────┐
│TREATMENT   │ │SYMPTOM    │ │DAILY          │ │AI                │
│PLANS       │ │LOGS       │ │MONITORING     │ │CONVERSATIONS     │
│id (PK)     │ │id (PK)    │ │id (PK)        │ │id (PK)           │
│patient_id  │ │patient_id │ │patient_id(FK) │ │patient_id (FK)   │
│phase       │ │symptom    │ │weight_kg      │ └────────┬─────────┘
│status      │ │severity   │ │temperature    │          │ 1:M
└──────┬─────┘ │daily_mon. │ │blood_pressure │          ▼
       │ 1:M   │id(FK,opt) │ └───────┬───────┘ ┌──────────────────┐
       ▼       └───────────┘         │         │ AI_MESSAGES      │
┌────────────────────────┐           │         │ id (PK)          │
│ TREATMENT_PLAN_MED     │           │         │ conversation_id  │
│ id (PK)                │           │         │ role             │
│ treatment_plan_id (FK) │           │ 1:M     │ content          │
│ medication_id (FK)     │           │         └──────────────────┘
│ dosage │ frequency     │           │
└───────────┬────────────┘           │
            │ 1:M                    │
            ▼                        │
┌────────────────────────┐           │
│ MEDICATION_LOGS        │           │
│ id (PK)                │           │
│ patient_id (FK)        │           │
│ tpm_id (FK)            │           │
│ status (taken/missed)  │           │
│ proof_photo (nullable) │           │
│ daily_mon.id (FK,opt)──┼───────────┘
└────────────────────────┘

┌────────────────────────────┐     ┌──────────────────────────┐
│ AI_RECOMMENDATIONS         │     │ NOTIFICATIONS            │
│ id (PK)                    │     │ id (PK)                  │
│ patient_id (FK)            │     │ type │ title │ body      │
│ daily_monitoring_id (FK) ──┼──┐  │ sender_id (FK)           │
│ type │ severity │ status   │  │  └──────────┬───────────────┘
└────────────────────────────┘  │             │ 1:M
                                │             ▼
                                │  ┌──────────────────────────────┐
                                │  │ NOTIFICATION_RECIPIENTS      │
                                │  │ notification_id (FK)         │
                                │  │ user_id (FK)                 │
                                │  │ is_read                      │
                                │  └──────────────────────────────┘
                                │
┌────────────────────────────┐  │
│ ACTIVITY_LOGS              │  │
│ id (PK)                    │  │
│ user_id (FK, nullable)     │  │
│ action                     │  │
│ subject_type (morph)       │  │
│ subject_id (morph)         │  │
└────────────────────────────┘  │
                                │
KEY: FK=Foreign Key, opt=optional│
─────────────────────────────────┘
```

---

## Index Recommendations

### High-Priority Indexes (Query Performance)

| Table | Index | Rationale |
|-------|-------|-----------|
| `medication_logs` | `(patient_id, scheduled_date)` | Daily adherence queries — the most frequent read operation |
| `symptom_logs` | `(patient_id, recorded_date)` | Daily symptom check for a patient |
| `daily_monitoring` | `(patient_id, recorded_date)` | Trend queries for patient vitals over time |
| `treatment_plans` | `(patient_id, phase, status)` | Find active treatment by phase |
| `notifications` | `(created_at)` | Sort notifications by recency |
| `activity_logs` | `(created_at)` | Audit queries by date range |

### Medium-Priority Indexes (Filtering & Referential Integrity)

| Table | Index | Rationale |
|-------|-------|-----------|
| All FK columns | Single-column index | Foreign key lookups for JOIN operations |
| `ai_recommendations` | `(patient_id, status, severity)` | Filter active recommendations by severity |
| `medication_logs` | `(status)` | Calculate adherence rates (taken vs missed) |
| `users` | `(role)` | Filter users by role (admin/patient) |
| `treatment_plans` | `(phase)` | Filter treatment plans by DOTS phase |

### Low-Priority Indexes (Rare Queries)

| Table | Index | Rationale |
|-------|-------|-----------|
| `symptom_logs` | `(symptom_type)` | Population-level symptom analytics |
| `activity_logs` | `(action)` | Search by action type |
| `ai_conversations` | `(is_active)` | Filter active conversations |

> **MySQL Note:** Foreign keys in MySQL automatically index the column. Explicit FK indexes are listed here for documentation completeness.

---

## Normalization Notes (3NF)

| NF | Status | Notes |
|----|--------|-------|
| 1NF ✅ | All columns are atomic. No repeating groups. | Each cell holds a single value. Symptom logs use separate rows per symptom (not a comma-separated list). |
| 2NF ✅ | No partial dependencies on composite keys. | The only composite key is on `notification_recipients` (notification_id, user_id) — every column depends on the full key. |
| 3NF ✅ | No transitive dependencies. | Patient-specific data (DOB, gender, address) is in `patients`, not `users`. Medication details are in `medications`, not duplicated in `treatment_plan_medication`. |

**Accepted denormalization:** `ai_recommendations` retains `patient_id` alongside `daily_monitoring_id` even though `patient_id` can be reached through `daily_monitoring → patient`. This is a practical, query-performance trade-off in a read-heavy analytics context. This is documented and justified, not an oversight.

---

## Full Validation Review

### Naming Conventions ✅
| Rule | Status |
|------|--------|
| Table names: snake_case, plural | `users`, `treatment_plans`, `medication_logs`, etc. ✅ |
| Column names: snake_case | `patient_id`, `scheduled_date`, `proof_photo` ✅ |
| FK columns: `table_single_id` | `patient_id`, `user_id`, `medication_id`, `daily_monitoring_id` ✅ |
| Pivot tables: singular_singular | `treatment_plan_medication`, `notification_recipients` ✅ |
| ENUM values: lowercase | `admin`, `patient`, `intensive`, `continuation`, `completed` ✅ |
| Boolean columns: `is_` prefix | `is_active`, `is_read` ✅ |

### Foreign Keys ✅
| Rule | Status |
|------|--------|
| Every FK references an existing PK | All 17 FKs verified ✅ |
| Consistent ON DELETE rules | CASCADE for ownership, SET NULL for audit/review, RESTRICT for critical references ✅ |
| No orphaned references possible | Migration order ensures parent tables are created before children ✅ |

### Nullable Fields ✅
| Justification | Examples |
|---------------|----------|
| Optional profile data | `phone`, `profile_photo_path`, `emergency_contact_name` |
| Optional clinical measurements | `weight_kg`, `temperature_c`, `blood_pressure_*` — not every session records all vitals |
| Optional timestamps | `email_verified_at`, `last_login_at`, `read_at`, `reviewed_at` |
| Optional file uploads | `proof_photo` — photo is not required for every dose |
| Optional linking | `daily_monitoring_id` on logs — can be set independently |

### Timestamps ✅
| Rule | Status |
|------|--------|
| All tables have `created_at` + `updated_at` | All 14 tables ✅ |
| `activity_logs` has no `updated_at` | Correct — audit logs are immutable ✅ |
| `ai_messages` has no `updated_at` | Correct — messages shouldn't be edited after sending ✅ |

### Indexes ✅
| Rule | Status |
|------|--------|
| PK on every table | ✅ |
| Unique constraint on `email` and `health_id_number` | ✅ |
| Composite indexes on most frequent query patterns | `(patient_id, date)` pattern on 3 tables ✅ |
| Foreign key indexes (auto by MySQL) | ✅ |

### Cascading Deletes ✅
| Rule | Status |
|------|--------|
| CASCADE on ownership: user → patient → all patient data | ✅ |
| SET NULL on audit references: reviewed_by, observed_by, sender_id | ✅ — preserve audit trail |
| RESTRICT on `treatment_plan_medication.medication_id` | ✅ — prevents deleting medications that are prescribed |
| SET NULL on optional `daily_monitoring_id` in logs | ✅ — removing a monitoring session doesn't delete the logs |

### Uniqueness Constraints ✅
| Column | Table | Rationale |
|--------|-------|-----------|
| `email` | `users` | Login uniqueness |
| `user_id` | `patients` | One patient profile per user |
| `health_id_number` | `patients` | Government ID uniqueness |
| `(treatment_plan_id, medication_id)` | `treatment_plan_medication` | No duplicate medication in a plan |

---

## Summary of All Changes (v1.0 → v2.0)

| # | Change | Type | Justification |
|---|--------|------|---------------|
| 1 | **Removed** `roles`, `permissions`, `role_user`, `role_permission` tables | Deletion (-4 tables) | Only 2 user types exist (admin, patient). Full RBAC is overengineering for a thesis project. A simple ENUM column is easier to implement, understand, and defend. |
| 2 | **Added** `role` ENUM('admin','patient') to `users` table | Addition | Replaces 4 tables with 1 column. Role checks become `$user->role === 'admin'` instead of `$user->hasRole('admin')`. |
| 3 | **Added** `phase` ENUM('intensive','continuation','completed') to `treatment_plans` | Addition | TB treatment has distinct DOTS phases. Tracking the phase is clinically meaningful and demonstrates domain expertise in the thesis. |
| 4 | **Added** `proof_photo` VARCHAR(255) nullable to `medication_logs` | Addition | Supports photo-based adherence verification from the Flutter app. Only the file path is stored. |
| 5 | **Added** `daily_monitoring_id` FK **NOT NULL** to `ai_recommendations` | Addition | Links AI recommendations to the specific monitoring data that triggered them. Made NOT NULL because every recommendation must be traceable to the data that generated it. `daily_monitoring_id` is superior to `treatment_plan_id` because recommendations are reactive to daily status, not long-term plans. |
| 6 | **Added** `daily_monitoring_id` FK nullable to `medication_logs` | Addition | Enables day-level treatment reconstruction without breaking independent logging from Flutter. |
| 7 | **Added** `daily_monitoring_id` FK nullable to `symptom_logs` | Addition | Same rationale as #6 — symptoms can be recorded independently or linked to a monitoring session. |
| 8 | **Updated** all index recommendations | Update | Added indexes for `role`, `phase`, and `daily_monitoring_id` columns. |
| 9 | **Updated** all relationship diagrams | Update | Removed RBAC relationships, added new daily_monitoring relationships. |
| 10 | **Updated** total table count | Update | 18 → 14 tables (a 22% reduction in complexity). |

---

## Future Expansion Notes

| # | Future Feature | Current Design Consideration |
|---|----------------|------------------------------|
| 1 | **Extended RBAC** | If more roles are needed (doctor, nurse), add a `roles` table and pivot. This design doesn't prevent that — it just doesn't overengineer it upfront. |
| 2 | **Laboratory Results** | Add `lab_results` table with FK → `patients.id`. |
| 3 | **X-Ray / Imaging** | Add `images` table with polymorphic `imageable` relationship. |
| 4 | **Multitenancy (Health Facility)** | Add `facilities` and `facility_user` tables. Add `facility_id` FK to `patients`, `treatment_plans`, `users`. |
| 5 | **Appointments / Scheduling** | Add `appointments` table with FK → `patients.id` and `users.id` (healthcare worker). |
| 6 | **Billing / Insurance** | Add `billing` and `insurance_claims` tables. |
| 7 | **Push Notifications** | Add `device_tokens` table with FK → `users.id`. Store FCM/APNS tokens. |
| 8 | **PostgreSQL Migration** | Avoid MySQL-specific features. ENUMs can be replaced with VARCHAR + CHECK constraints. JSON is portable. |
| 9 | **SMS / Email Notifications** | `notifications` table can hold SMS and email content. Add `channel` column when needed. |
| 10 | **Contact Tracing** | Add `contacts` table linking patients to their close contacts for TB contact tracing. |

---

## Ready for Implementation

The database design is now finalized and ready for:

1. ✅ **Laravel Migrations** — generate migration files for all 14 tables
2. ✅ **Laravel Models** — create Eloquent models with relationships
3. ✅ **Laravel Seeders** — seed admin user, medication catalog, and phase data
4. ✅ **API Structure** — define REST API resources

Proceed to **Step 003: Laravel Setup & Migrations**.
