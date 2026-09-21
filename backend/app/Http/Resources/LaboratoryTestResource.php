<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class LaboratoryTestResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'test_type' => $this->test_type,
            'test_name' => $this->test_name,
            'test_date' => $this->test_date,
            'result' => $this->result,
            'status' => $this->status,
            'remarks' => $this->remarks,
        ];
    }
}
