<?php

namespace App\Features\Identity\Controllers;

use App\Features\Identity\Resources\UserResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class ProfileController
{
    public function show(Request $request): UserResource
    {
        return new UserResource($request->user()->load('roles', 'tenant'));
    }

    public function update(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'email' => ['required', 'email:rfc', 'max:255', Rule::unique('users')->where(fn ($query) => $query->where('tenant_id', $user->tenant_id))->ignore($user->id)],
            'phone' => ['nullable', 'string', 'max:20'],
            'profile_photo' => ['nullable', 'file', 'mimetypes:image/jpeg,image/png,image/webp', 'max:2048'],
        ]);
        if ($request->hasFile('profile_photo')) {
            if ($user->profile_photo_path) Storage::disk('public')->delete($user->profile_photo_path);
            $data['profile_photo_path'] = $request->file('profile_photo')->store("profiles/{$user->tenant_id}", 'public');
        }
        unset($data['profile_photo']);
        $user->update($data);

        return response()->json(['success' => true, 'message' => 'Profile updated.', 'data' => new UserResource($user->fresh()->load('roles', 'tenant'))]);
    }
}
