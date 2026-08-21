<?php
namespace App\Support\ErpControl\Contracts;
final readonly class ControlPlaneResult { public function __construct(public bool $accepted,public int $appliedVersion,public string $appliedAt,public ?string $message=null){} public function toArray():array{return ['accepted'=>$this->accepted,'applied_version'=>$this->appliedVersion,'applied_at'=>$this->appliedAt,'message'=>$this->message];} }
