<?php

namespace App\Policies;

use App\Models\User;
use App\Models\VotSubmission;

/**
 * Who may see and review a VOT proof. Laravel finds this policy by name
 * (VotSubmission → VotSubmissionPolicy); controllers call Gate::authorize().
 */
class VotSubmissionPolicy
{
    /** The review queue is for portal staff only — never patients. */
    public function viewAny(User $user): bool
    {
        return in_array($user->role, User::PORTAL_ROLES, true);
    }

    public function view(User $user, VotSubmission $submission): bool
    {
        return $this->viewAny($user)
            && ($submission->patient?->isVisibleTo($user) ?? false);
    }

    public function review(User $user, VotSubmission $submission): bool
    {
        return $this->view($user, $submission);
    }
}
