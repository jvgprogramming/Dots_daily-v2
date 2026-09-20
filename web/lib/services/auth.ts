import { api } from "./api";
import type {
  AuthResponse,
  ApiResponse,
  AuthUser,
  LoginPayload,
  RegisterPayload,
} from "@/lib/types";

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const res = await api.post<ApiResponse<AuthResponse>>("/login", payload);
  if (res.data) {
    localStorage.setItem("auth_token", res.data.token);
  }
  return res.data as AuthResponse;
}

export async function register(payload: RegisterPayload): Promise<AuthResponse> {
  const res = await api.post<ApiResponse<AuthResponse>>("/register", payload);
  if (res.data) {
    localStorage.setItem("auth_token", res.data.token);
  }
  return res.data as AuthResponse;
}

export async function logout(): Promise<void> {
  try {
    await api.post<ApiResponse>("/logout");
  } finally {
    localStorage.removeItem("auth_token");
  }
}

export async function getCurrentUser(): Promise<AuthUser> {
  const res = await api.get<ApiResponse<{ user: AuthUser }>>("/user");
  return res.data!.user;
}
