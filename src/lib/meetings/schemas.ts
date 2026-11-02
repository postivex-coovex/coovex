import { z } from 'zod'

export const eventTypeSchema = z.object({
  title: z.string().trim().min(2, 'Title is required').max(100),
  slug: z.string().regex(/^[a-z0-9-]{2,50}$/, 'URL must be lowercase letters, numbers and dashes').optional(),
  description: z.string().trim().max(1000).optional().default(''),
  duration_min: z.number().int().min(5).max(480),
  buffer_before_min: z.number().int().min(0).max(240).default(0),
  buffer_after_min: z.number().int().min(0).max(240).default(0),
  min_notice_hours: z.number().int().min(0).max(720).default(4),
  max_days_ahead: z.number().int().min(1).max(365).default(60),
  slot_interval_min: z.number().int().min(5).max(240).default(30),
  location_type: z.enum(['zoom', 'custom_link', 'phone', 'in_person', 'host_provides']),
  location_value: z.string().trim().max(500).optional().default(''),
  requires_confirmation: z.boolean().default(false),
  questions: z.array(z.object({
    id: z.string().max(40),
    label: z.string().trim().min(1).max(200),
    required: z.boolean(),
  })).max(10).default([]),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#2563eb'),
  active: z.boolean().default(true),
})

const interval = z.object({
  start_minute: z.number().int().min(0).max(1439),
  end_minute: z.number().int().min(1).max(1440),
}).refine(v => v.end_minute > v.start_minute, 'End time must be after start time')

export const availabilitySchema = z.object({
  weekly: z.array(interval.and(z.object({ weekday: z.number().int().min(0).max(6) }))).max(100),
  overrides: z.array(z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    start_minute: z.number().int().min(0).max(1439).nullable(),
    end_minute: z.number().int().min(1).max(1440).nullable(),
  })).max(400),
})

export const bookRequestSchema = z.object({
  username: z.string().min(1).max(60),
  event: z.string().min(1).max(60),
  start: z.string().min(10).max(40),
  name: z.string().trim().min(1, 'Please enter your name').max(100),
  email: z.string().trim().email('Please enter a valid email').max(200),
  phone: z.string().trim().max(40).optional().default(''),
  notes: z.string().trim().max(2000).optional().default(''),
  timezone: z.string().max(80),
  answers: z.record(z.string(), z.string().max(1000)).optional().default({}),
  website: z.string().optional().default(''), // honeypot
})
