import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function normalizePhoneNumber(phone: string): string {
    // Remove all non-digit characters
    const cleaned = phone.replace(/\D/g, '');

    // Check if it's a US number (10 digits or 11 starting with 1)
    if (cleaned.length === 10) {
        return `+1${cleaned}`;
    } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
        return `+${cleaned}`;
    }

    // Default: return original if we can't safely normalize, or maybe just +cleaned
    // Good practice is to return E.164 if possible. 
    // If it doesn't match US pattern, return with + prefix if not present to ensure standard format
    // But for safety on international, let's just prepend + if missing
    return phone.startsWith('+') ? phone : `+${cleaned}`;
}
