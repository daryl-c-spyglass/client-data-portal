import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function sanitizeFubNoteText(input: string | null | undefined): string {
  if (!input) return "";
  
  if (typeof window !== 'undefined' && window.DOMParser) {
    try {
      const doc = new DOMParser().parseFromString(input, 'text/html');
      let text = doc.body.textContent || doc.body.innerText || "";
      text = text.replace(/[ \t]+/g, " ");
      text = text.replace(/\n[ \t]+/g, "\n");
      text = text.replace(/[ \t]+\n/g, "\n");
      text = text.replace(/\n{3,}/g, "\n\n");
      return text.trim();
    } catch {
    }
  }
  
  let text = input;
  
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/p>/gi, "\n");
  text = text.replace(/<\/div>/gi, "\n");
  text = text.replace(/<\/li>/gi, "\n");
  
  text = text.replace(/<(span|a|strong|em|b|i)[^>]*>/gi, " ");
  text = text.replace(/<\/(span|a|strong|em|b|i)>/gi, " ");
  
  text = text.replace(/<[^>]*>/g, "");
  
  text = text.replace(/&nbsp;/g, " ");
  text = text.replace(/&amp;/g, "&");
  text = text.replace(/&lt;/g, "<");
  text = text.replace(/&gt;/g, ">");
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&apos;/g, "'");
  text = text.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
  
  text = text.replace(/[ \t]+/g, " ");
  text = text.replace(/\n[ \t]+/g, "\n");
  text = text.replace(/[ \t]+\n/g, "\n");
  text = text.replace(/\n{3,}/g, "\n\n");
  
  return text.trim();
}
