# DOTS Daily — What We Built (Plain-Language Overview)

*A guide for the team, written so anyone can follow it even without reading the code.*

---

## 1. What the system is

DOTS Daily is a tuberculosis (TB) treatment companion system for a DOTS center (a TB clinic). TB treatment takes many months, and a patient has to take their medicine every single day or the treatment can fail and the TB can become drug-resistant. Our system exists to make that daily routine easier for patients and easier for the clinic to supervise — which is the whole idea behind "DOTS" (Directly Observed Treatment, Short-course).

The system has three parts that work together:

- **The mobile app** (built with Flutter) is used by the **patient** on their own phone. It reminds them to take their medicine, lets them prove they took it, answers common questions, and lets them tell the clinic how they feel.
- **The web portal** (built with Next.js) is used by the **clinic staff** — the admin and the nurses — on a computer. It is where they register patients, watch each patient's progress, review the proof patients send, and get alerted when something needs attention.
- **The backend** (built with Laravel) is the engine in the middle. It stores all the data in a database and passes information between the app and the portal through an "API" (a set of web addresses the app and portal call to read and save data). The patient's phone and the clinic's computer never talk to each other directly — they both talk to the backend, so everyone always sees the same, up-to-date information.

In short: the **patient uses the app**, the **clinic uses the portal**, and the **backend keeps them in sync**.

---

## 2. The web portal (used by the clinic — admin and nurses)

When a staff member opens the portal, they first **log in**. The system knows two kinds of staff: an **admin**, who can do everything, and a **nurse**, who can do most things but, for example, only sees the patients they themselves registered. The menu on the side leads to these sections:

- **Dashboard** — the landing page that shows the clinic an overall summary, such as how many patients are active and how they are doing.

- **Patients** — where staff register a new patient (their personal details, TB classification, diagnosis, and so on) and open any patient's profile to review their registration record and treatment overview.

- **Treatments** — where the patient's treatment plan lives: which medicines they are on, when treatment started and is expected to end, and the schedule of follow-up visits. Staff can update the plan and reschedule follow-ups here.

- **Medication** — a simple inventory of the clinic's medicine stock, so staff can see what is available and track it as it is used.

- **Monitoring** — the most detailed per-patient view. For a chosen patient it shows a calendar of their daily medicine-taking, how well they are keeping up (their "adherence," meaning the percentage of expected days they actually took their dose), how far along they are in treatment, and warning indicators if they are falling behind or their plan is overdue. **This page also shows the symptoms a patient has reported from the app** (explained below), so the nurse can see any problems the patient is feeling.

- **Reports** — two things live here. First, adherence reports that summarize how patients are doing. Second, the **Video-Observed Therapy (VOT) review queue**: when patients record themselves taking their medicine, those videos arrive here for a nurse to review.

- **Settings** — clinic-wide rules: the thresholds that decide when a patient counts as "high risk," notification rules, the list of staff users, and the settings for the video-proof feature.

- **Notification bell** — at the top of the portal, a bell shows unread alerts. The clinic is notified when a patient misses several doses in a row, when a follow-up visit is coming up, when a patient submits a new proof video, and when a patient reports a serious symptom. Clicking an alert takes the staff member straight to the relevant patient.

---

## 3. The mobile app (used by the patient)

The patient logs in once on their phone. Across the bottom of the app are five tabs:

- **Home** — the main screen. At the very top is a clear **"Today's Dose"** card: if the patient hasn't taken their medicine yet, it shows one obvious button to do it; once they have, it changes to show that today is done and whether the clinic has reviewed it. The home screen also shows the patient's progress, their next reminder, and a small calendar of the days they have taken their medicine.

- **Reminder** — where the patient sets the single daily time they want to be reminded. The treatment is one combined dose taken once a day — any time during the day, but preferably before lunch — so there is just one reminder, and it can't be switched off (because the medicine must be taken every day), though the patient can change the *time*.

- **Calendar** — a month-by-month history of the patient's doses, showing taken days, and days a nurse has flagged for review.

- **Chat (ChatDoti)** — a built-in help section that answers common questions about TB and the medicine (for example, "When should I take my medicine?" or "What are the side effects?"). It works even without internet, because the answers are stored in the app.

- **Symptoms (Symptom Monitor)** — where the patient tells the clinic how they feel. They can tap any TB symptoms (cough, fever, night sweats, coughing up blood, and so on) or any medicine side effects (nausea, yellow eyes, rash, blurred vision, numbness, and more), and rate each one as mild, moderate, or severe. When they submit, the report goes to the clinic and appears on that patient's Monitoring page. If they report something dangerous — or mark anything as severe — the app immediately warns them to contact the clinic, and the clinic staff get an alert.

Beyond the tabs, two important things happen:

- **The alarm.** At the reminder time the phone rings with a full-screen alarm (it can ring even over the lock screen and even if the app is closed, like a real alarm clock). From that screen the patient confirms their dose. If they are not ready, they can snooze for five minutes or choose to take it later that day — the alarm never traps them, because the dose can be logged any time that day from the Home screen.

- **Proof of taking the medicine (Video-Observed Therapy).** Some patients are enrolled in VOT. For them, "taking the dose" means recording a short video of themselves swallowing the medicine. The app opens the camera, the patient records, reviews it, and submits it. The video is compressed on the phone to keep it small, uploaded to the clinic, and attached to that day's record. A nurse then reviews it in the portal and can verify it, reject it, or ask for a new one. Patients who are **not** enrolled in VOT simply tap one button to confirm they took their dose.

---

## 4. How the app and the portal connect (the core loop)

The heart of the system is a loop that ties the two sides together:

1. The patient takes their medicine and confirms it in the app (either with one tap, or by recording a proof video if they are enrolled in VOT).
2. That confirmation is saved to the backend database.
3. The clinic immediately sees it in the portal — in the patient's Monitoring calendar, in the adherence reports, and, for videos, in the VOT review queue.
4. If something needs attention — a patient falling behind, a new proof video, or a worrying symptom — the backend creates a notification that shows up in the clinic's bell.
5. When a nurse reviews a video or follows up, any decision (verified, flagged, new proof requested) flows back and the patient is notified in their app.

Because everything goes through one shared backend, the patient and the clinic are always looking at the same information.

---

## 5. The main features we added and improved

To put our work in context, these are the capabilities the project focused on:

- **Video proof of medicine intake (VOT):** patients can record themselves taking their dose, and nurses review those recordings in the portal. The videos are stored securely and are only reachable through links that expire, because they are private health data.

- **A lighter review model for nurses:** instead of a nurse having to approve every single dose, doses are accepted by default and a nurse only needs to **flag** a video that looks suspicious, which reduces their workload. A flagged dose is held out of the adherence count until it is resolved.

- **A dependable daily alarm:** the reminder rings full-screen like a real alarm, survives the phone restarting, and nudges the patient to take their one daily dose (preferably before lunch) without ever locking them out of the rest of the app.

- **ChatDoti:** an easy, offline question-and-answer helper for patients.

- **Symptom Monitor:** patients can report TB symptoms and medicine side effects; dangerous reports warn the patient and alert the clinic, and all reports appear on the patient's Monitoring page.

- **A clearer, simpler patient experience:** one obvious "take your dose" action on the home screen, and plain language throughout so patients always know what to do.

---

*This document describes the system as it stands at the current point in development. The patient-facing app is in Flutter, the clinic portal is in Next.js, and both rely on the shared Laravel backend and its database.*
