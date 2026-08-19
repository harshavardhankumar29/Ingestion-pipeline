import { z } from 'zod';

// Standardized normalized job schema supporting data drift & alternative key aliases (position -> title)
export const JobListingSchema = z.object({
  id: z.string().or(z.number()).transform(val => String(val)),
  title: z.string().optional(),
  position: z.string().optional(),
  company: z.string().default("Unknown Company"),
  location: z.string().default("Remote"),
  url: z.string().default("https://remoteok.com"),
  date: z.string().optional(),
  tags: z.array(z.string()).default([]),
}).transform(data => ({
  id: String(data.id),
  title: data.title || data.position || "Untitled Position",
  company: data.company || "Unknown Company",
  location: data.location || "Remote",
  url: data.url,
  date: data.date,
  tags: Array.isArray(data.tags) ? data.tags : [],
}));

export type JobListing = z.infer<typeof JobListingSchema>;

/**
 * Safely parses raw listings and separates valid items from drifted/corrupted ones
 */
export function validateJobListings(rawItems: unknown[]): { valid: JobListing[]; invalidCount: number } {
  const valid: JobListing[] = [];
  let invalidCount = 0;

  for (const item of rawItems) {
    const result = JobListingSchema.safeParse(item);
    if (result.success) {
      valid.push(result.data);
    } else {
      invalidCount++;
      console.warn(`[Schema] Data drift detected in item:`, result.error.format());
    }
  }

  return { valid, invalidCount };
}
