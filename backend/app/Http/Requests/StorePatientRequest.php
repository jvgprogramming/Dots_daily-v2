<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StorePatientRequest extends FormRequest
{
    /**
     * Draft mode relaxes validation: only enough data to identify the record.
     */
    public function isDraft(): bool
    {
        return $this->input('status') === 'draft' || $this->input('mode') === 'draft';
    }

    public function authorize(): bool
    {
        return $this->user()?->isAdmin() ?? false;
    }

    public function rules(): array
    {
        if ($this->isDraft()) {
            return $this->draftRules();
        }

        return $this->registrationRules();
    }

    private function draftRules(): array
    {
        return [
            // Minimum to identify/resume a draft
            'name' => ['required_without:last_name', 'nullable', 'string', 'max:255'],
            'last_name' => ['required_without:name', 'nullable', 'string', 'max:255'],
            'first_name' => ['nullable', 'string', 'max:255'],

            // Optional account — may be created later
            'email' => ['nullable', 'string', 'email', 'max:255', Rule::unique('users', 'email')->ignore($this->input('user_id'))],
            'password' => ['nullable', 'string', 'min:8'],

            // Everything else stored as-is in draft_data
            'date_of_birth' => ['nullable', 'date'],
            'gender' => ['nullable', 'string', 'in:male,female,other'],
            'weight_kg' => ['nullable', 'numeric', 'min:1', 'max:500'],
            'status' => ['required', 'in:draft'],
        ];
    }

    private function registrationRules(): array
    {
        return [
            // Account
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', Rule::unique('users', 'email')],
            'phone' => ['nullable', 'string', 'max:20'],
            'password' => ['required', 'string', 'min:8'],

            // Demographics
            'last_name' => ['required', 'string', 'max:255'],
            'first_name' => ['required', 'string', 'max:255'],
            'middle_name' => ['nullable', 'string', 'max:255'],
            'name_extension' => ['nullable', 'string', 'max:20'],
            'date_of_birth' => ['required', 'date', 'before:today'],
            'gender' => ['required', 'string', 'in:male,female,other'],
            'weight_kg' => ['nullable', 'numeric', 'min:1', 'max:500'],
            'civil_status' => ['nullable', 'string', 'max:20'],
            'nationality' => ['nullable', 'string', 'max:100'],
            'address' => ['required', 'string', 'max:500'],
            'contact_number' => ['nullable', 'string', 'max:20'],
            'philhealth_number' => ['nullable', 'string', 'max:30'],

            // Notification & facility
            'notification' => ['required', 'array'],
            'notification.reason' => ['required', 'string', 'in:new,update,final_outcome'],
            'notification.facility_name' => ['nullable', 'string', 'max:255'],
            'notification.ntp_facility_code' => ['nullable', 'string', 'max:50'],
            'notification.province_huc' => ['nullable', 'string', 'max:255'],
            'notification.region' => ['nullable', 'string', 'max:255'],

            // Laboratory tests — optional array of tests
            'laboratory_tests' => ['nullable', 'array'],
            'laboratory_tests.*.test_type' => ['required_with:laboratory_tests', 'string', 'max:50'],
            'laboratory_tests.*.test_name' => ['nullable', 'string', 'max:255'],
            'laboratory_tests.*.test_date' => ['nullable', 'date'],
            'laboratory_tests.*.result' => ['nullable', 'string', 'max:255'],
            'laboratory_tests.*.status' => ['nullable', 'string', 'in:done,not_available,not_yet_done'],
            'laboratory_tests.*.remarks' => ['nullable', 'string', 'max:500'],

            // Diagnosis
            'diagnosis' => ['required', 'array'],
            'diagnosis.diagnosis_type' => ['required', 'string', 'in:tb_disease,tb_infection'],
            'diagnosis.diagnosis_date' => ['required', 'date'],
            'diagnosis.notification_date' => ['nullable', 'date'],
            'diagnosis.case_number' => ['nullable', 'string', 'max:50'],
            'diagnosis.attending_physician' => ['nullable', 'string', 'max:255'],
            'diagnosis.referral_name' => ['nullable', 'string', 'max:255'],
            'diagnosis.referral_address' => ['nullable', 'string', 'max:500'],
            'diagnosis.referral_facility_code' => ['nullable', 'string', 'max:50'],
            'diagnosis.referral_province_huc' => ['nullable', 'string', 'max:255'],
            'diagnosis.referral_region' => ['nullable', 'string', 'max:255'],

            // TB classification
            'classification' => ['required', 'array'],
            'classification.bacteriological_status' => ['required', 'string', 'in:bacteriologically_confirmed,clinically_diagnosed'],
            'classification.anatomical_site' => ['required', 'string', 'in:pulmonary,extrapulmonary'],
            'classification.extrapulmonary_site' => ['required_if:classification.anatomical_site,extrapulmonary', 'nullable', 'string', 'max:255'],
            'classification.drug_resistance_status' => ['required', 'string', 'in:drug_susceptible,bc_rr_tb,bc_mdr_tb,bc_xdr_tb,cd_mdr_tb,other_dr_resistant'],
            'classification.registration_group' => ['required', 'string', 'in:new,relapse,taf,tpt,talf,unknown_history'],

            // Treatment start (outcome fields NOT required — added later)
            'treatment' => ['required', 'array'],
            'treatment.start_date' => ['required', 'date'],
            'treatment.regimen_type' => ['required', 'string', 'max:50'],
            'treatment.notes' => ['nullable', 'string', 'max:1000'],

            // Close contacts — optional repeatable rows
            'close_contacts' => ['nullable', 'array'],
            'close_contacts.*.full_name' => ['required_with:close_contacts', 'string', 'max:255'],
            'close_contacts.*.age' => ['nullable', 'integer', 'min:0', 'max:150'],
            'close_contacts.*.sex' => ['nullable', 'string', 'in:male,female'],
            'close_contacts.*.relationship' => ['nullable', 'string', 'max:100'],
            'close_contacts.*.screening_date' => ['nullable', 'date'],
            'close_contacts.*.followup_date' => ['nullable', 'date'],
            'close_contacts.*.remarks' => ['nullable', 'string', 'max:500'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'Patient full name is required.',
            'email.required' => 'Email address is required.',
            'email.unique' => 'This email is already registered.',
            'password.required' => 'Password is required.',
            'password.min' => 'Password must be at least 8 characters.',
            'last_name.required' => 'Patient surname is required.',
            'first_name.required' => 'Patient given name is required.',
            'date_of_birth.required' => 'Date of birth is required.',
            'gender.required' => 'Sex is required.',
            'address.required' => 'Permanent address is required.',
            'weight_kg.numeric' => 'Weight must be a number.',
            'weight_kg.min' => 'Weight must be at least 1 kg.',
            'weight_kg.max' => 'Weight cannot exceed 500 kg.',
            'notification.required' => 'Notification and facility information is required.',
            'notification.reason.required' => 'Reason for notification is required.',
            'diagnosis.required' => 'Diagnosis information is required.',
            'diagnosis.diagnosis_type.required' => 'Diagnosis type is required.',
            'diagnosis.diagnosis_date.required' => 'Date of diagnosis is required.',
            'classification.required' => 'TB classification is required.',
            'classification.bacteriological_status.required' => 'Bacteriological status is required.',
            'classification.anatomical_site.required' => 'Anatomical site is required.',
            'classification.extrapulmonary_site.required_if' => 'Please specify the extra-pulmonary site.',
            'classification.drug_resistance_status.required' => 'Drug resistance status is required.',
            'classification.registration_group.required' => 'Registration group is required.',
            'treatment.required' => 'Treatment start information is required.',
            'treatment.start_date.required' => 'Treatment start date is required.',
            'treatment.regimen_type.required' => 'Starting regimen is required.',
        ];
    }
}
