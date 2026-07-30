// Services taxonomy — the Services-section catalog structure, mirroring the retail TAXONOMY and the
// APP_TAXONOMY so the Services store gets the SAME sections + subsections + serverless-GPU category
// tiles + search as every other marketplace section.
//   Level 1  top service categories (below)
//   Level 2  subsections per category (below)
// Category tiles are generated ONCE each on the serverless GPU (see aiServiceCategoryImages), stored in
// CatalogCategory with kind:"service", exactly like the retail and app category tiles.

import type { TopCategory } from "./taxonomy.ts";

export const SERVICE_TAXONOMY: TopCategory[] = [
  { name: "Home & Repair", subs: ["Handyman", "Plumbing", "Electrical", "HVAC", "Painting", "Appliance Repair", "Assembly & Installation", "Landscaping", "Roofing", "Flooring"] },
  { name: "Cleaning", subs: ["House Cleaning", "Deep Cleaning", "Carpet Cleaning", "Window Cleaning", "Move-Out Cleaning", "Pressure Washing"] },
  { name: "Tutoring & Education", subs: ["Math", "Science", "Languages", "Test Prep", "Music Lessons", "Coding & STEM", "Homework Help", "Reading & Writing"] },
  { name: "Design & Creative", subs: ["Logo & Branding", "Graphic Design", "Web Design", "UI/UX", "Illustration", "3D & Animation", "Product Design"] },
  { name: "Writing & Translation", subs: ["Copywriting", "Editing & Proofreading", "Resume Writing", "Translation", "Transcription", "Technical Writing", "Ghostwriting"] },
  { name: "Tech & IT", subs: ["Computer Repair", "Web Development", "App Development", "IT Support", "Data & Analytics", "Cybersecurity", "QA & Testing", "DevOps"] },
  { name: "Marketing", subs: ["Social Media", "SEO", "Content Marketing", "Paid Ads", "Email Marketing", "Influencer Marketing", "Analytics"] },
  { name: "Business & Consulting", subs: ["Bookkeeping", "Consulting", "Virtual Assistant", "Data Entry", "Project Management", "HR & Recruiting", "Market Research"] },
  { name: "Legal & Financial", subs: ["Tax Prep", "Accounting", "Legal Advice", "Contracts", "Financial Planning", "Notary"] },
  { name: "Photography & Video", subs: ["Portraits", "Events", "Product Photography", "Real Estate", "Video Editing", "Drone", "Photo Editing"] },
  { name: "Health & Wellness", subs: ["Personal Training", "Nutrition Coaching", "Yoga", "Massage", "Physical Therapy", "Mental Wellness", "Meditation"] },
  { name: "Beauty & Personal Care", subs: ["Hair", "Makeup", "Nails", "Skincare", "Barber", "Grooming"] },
  { name: "Coaching", subs: ["Life Coaching", "Career Coaching", "Business Coaching", "Public Speaking", "Relationship Coaching"] },
  { name: "Events", subs: ["Event Planning", "Catering", "DJs & Music", "Photography", "Decor", "Officiants", "Bartending"] },
  { name: "Automotive", subs: ["Repair", "Detailing", "Oil Change", "Tires", "Mobile Mechanic", "Inspection"] },
  { name: "Moving & Delivery", subs: ["Local Moving", "Furniture Delivery", "Junk Removal", "Packing", "Courier"] },
  { name: "Pets", subs: ["Dog Walking", "Pet Sitting", "Grooming", "Training", "Boarding"] },
  { name: "Lessons & Hobbies", subs: ["Music", "Art", "Dance", "Cooking", "Sports Coaching", "Crafts"] },
];

/** All service subsections flattened (level 2). */
export function allServiceSubcategories(): string[] {
  return SERVICE_TAXONOMY.flatMap((t) => t.subs);
}
