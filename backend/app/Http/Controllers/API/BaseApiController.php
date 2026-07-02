<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Traits\ApiResponse;

abstract class BaseApiController extends Controller
{
    use ApiResponse;
}
