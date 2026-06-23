import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function decodeHtml(html: string) {
    if (!html) return "";
    return html.replace(/&quot;/g, '"')   // all " codes → "
        .replace(/&amp;/g, '&')            // all & codes → &
        .replace(/&#39;/g, "'")            // all ' codes → '
        .replace(/&lt;/g, '<')             // all < codes → 
        .replace(/&gt;/g, '>');
}