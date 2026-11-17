<?php

namespace App\Support;

/**
 * The curated catalogue of TB symptoms and TB-medication side effects a patient
 * can self-report from the mobile app's Symptom Monitor.
 *
 * This is the single source of truth: StoreSymptomLogRequest validates against
 * it, MobileSymptomController reads labels + red-flag status from it, and the
 * Flutter app keeps a matching copy (lib/data/symptom_catalog.dart). A report is
 * a "red flag" when the symptom itself is dangerous (e.g. jaundice, coughing
 * blood) OR when the patient rates any symptom as `severe` — either way the
 * clinic is alerted and the patient is told to seek care.
 */
class Symptoms
{
    public const SEVERITIES = ['mild', 'moderate', 'severe'];

    public const CATEGORY_DISEASE = 'disease';

    public const CATEGORY_SIDE_EFFECT = 'side_effect';

    /**
     * slug => [label, category, red_flag].
     *
     * @var array<string, array{label: string, category: string, red_flag: bool}>
     */
    public const CATALOG = [
        // ── TB disease symptoms ──
        'cough' => ['label' => 'Cough', 'category' => self::CATEGORY_DISEASE, 'red_flag' => false],
        'coughing_blood' => ['label' => 'Coughing up blood', 'category' => self::CATEGORY_DISEASE, 'red_flag' => true],
        'fever' => ['label' => 'Fever', 'category' => self::CATEGORY_DISEASE, 'red_flag' => false],
        'night_sweats' => ['label' => 'Night sweats', 'category' => self::CATEGORY_DISEASE, 'red_flag' => false],
        'weight_loss' => ['label' => 'Weight loss', 'category' => self::CATEGORY_DISEASE, 'red_flag' => false],
        'loss_of_appetite' => ['label' => 'Loss of appetite', 'category' => self::CATEGORY_DISEASE, 'red_flag' => false],
        'fatigue' => ['label' => 'Tiredness or weakness', 'category' => self::CATEGORY_DISEASE, 'red_flag' => false],
        'chest_pain' => ['label' => 'Chest pain', 'category' => self::CATEGORY_DISEASE, 'red_flag' => false],
        'severe_breathlessness' => ['label' => 'Severe shortness of breath', 'category' => self::CATEGORY_DISEASE, 'red_flag' => true],

        // ── TB-medication side effects ──
        'nausea' => ['label' => 'Nausea or vomiting', 'category' => self::CATEGORY_SIDE_EFFECT, 'red_flag' => false],
        'severe_vomiting' => ['label' => 'Severe or constant vomiting', 'category' => self::CATEGORY_SIDE_EFFECT, 'red_flag' => true],
        'jaundice' => ['label' => 'Yellow eyes or skin', 'category' => self::CATEGORY_SIDE_EFFECT, 'red_flag' => true],
        'dark_urine' => ['label' => 'Dark-coloured urine', 'category' => self::CATEGORY_SIDE_EFFECT, 'red_flag' => true],
        'rash' => ['label' => 'Skin rash or itching', 'category' => self::CATEGORY_SIDE_EFFECT, 'red_flag' => false],
        'severe_rash' => ['label' => 'Severe or spreading rash', 'category' => self::CATEGORY_SIDE_EFFECT, 'red_flag' => true],
        'vision_changes' => ['label' => 'Blurred or changed vision', 'category' => self::CATEGORY_SIDE_EFFECT, 'red_flag' => true],
        'hearing_changes' => ['label' => 'Hearing problems or ringing', 'category' => self::CATEGORY_SIDE_EFFECT, 'red_flag' => true],
        'numbness' => ['label' => 'Numbness or tingling in hands or feet', 'category' => self::CATEGORY_SIDE_EFFECT, 'red_flag' => false],
        'joint_pain' => ['label' => 'Joint pain', 'category' => self::CATEGORY_SIDE_EFFECT, 'red_flag' => false],
        'dizziness' => ['label' => 'Dizziness', 'category' => self::CATEGORY_SIDE_EFFECT, 'red_flag' => false],
    ];

    /** @return list<string> Every valid symptom slug. */
    public static function slugs(): array
    {
        return array_keys(self::CATALOG);
    }

    /** Human label for a slug (falls back to the slug when unknown). */
    public static function label(string $slug): string
    {
        return self::CATALOG[$slug]['label'] ?? $slug;
    }

    /** Whether this symptom is dangerous in itself, regardless of severity. */
    public static function isRedFlag(string $slug): bool
    {
        return self::CATALOG[$slug]['red_flag'] ?? false;
    }

    /** A report is a red flag when the symptom is dangerous or rated severe. */
    public static function isRedFlagReport(string $slug, string $severity): bool
    {
        return self::isRedFlag($slug) || $severity === 'severe';
    }
}
