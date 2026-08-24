import { getEnv } from "@/lib/config/env";
import { GoogleGmailProvider } from "./googleProvider";
import { MockGmailProvider } from "./mockProvider";
import type { GmailProvider } from "./types";

let cached: GmailProvider | undefined;

export function getGmailProvider(): GmailProvider {
  if (cached) return cached;
  cached = getEnv().GMAIL_PROVIDER === "google" ? new GoogleGmailProvider() : new MockGmailProvider();
  return cached;
}
