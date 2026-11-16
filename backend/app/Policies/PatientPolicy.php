<?php

namespace App\Policies;

use App\Models\Patient;
use App\Models\User;

/**
 * Patient-level abilities. Only VOT is defined here for now; existing patient
 * endpoints keep their `role:` middleware + `scopeVisibleTo` checks.
 */
class PatientPolicy
{
    /** Grant, suspend or revoke a patient's video-observed therapy. */
    public function manageVot(User $user, Patient $patient): bool
    {
        return in_array($user->role, User::PORTAL_ROLES, true)
            && $patient->isVisibleTo($user);
    }
}
