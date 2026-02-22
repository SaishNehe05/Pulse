/**
 * Centralized Date & Time Utility for Pulse
 */

export const safeDate = (dateStr: any): Date => {
    if (!dateStr) return new Date();

    // If it's already a Date object, return it
    if (dateStr instanceof Date) return dateStr;

    // Handle string dates
    if (typeof dateStr === 'string') {
        const str = dateStr.trim();

        // Use regex to extract parts for reliable UTC construction
        // Matches "YYYY-MM-DD HH:MM:SS" or "YYYY-MM-DDTHH:MM:SS"
        const match = str.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/);

        if (match) {
            const year = parseInt(match[1]);
            const month = parseInt(match[2]) - 1; // 0-indexed
            const day = parseInt(match[3]);
            const hour = parseInt(match[4]);
            const minute = parseInt(match[5]);
            const second = parseInt(match[6]);

            // We assume Supabase always sends UTC. Date.UTC creates epoch in UTC.
            return new Date(Date.UTC(year, month, day, hour, minute, second));
        }

        const d = new Date(str);
        return isNaN(d.getTime()) ? new Date() : d;
    }

    // Fallback for other types
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? new Date() : d;
};

/**
 * Formats a date string according to Pulse's premium brand guidelines:
 * - If today: Only the time (e.g., "14:30") OR "Today" for headers.
 * - If yesterday: Always "Yesterday".
 * - If older: The date (e.g., "Feb 15").
 */
export const formatPulseDate = (dateStr: string, options: { isHeader?: boolean; includeTime?: boolean } = {}) => {
    const date = safeDate(dateStr);
    const now = new Date();

    const isToday = date.toDateString() === now.toDateString();

    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    if (isToday) {
        if (options.isHeader) return 'Today';
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    }

    if (isYesterday) {
        return 'Yesterday';
    }

    // Older than yesterday
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

/**
 * Specifically for message timestamps inside the chat bubble
 */
export const formatMessageTime = (dateStr: string) => {
    const date = safeDate(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
};

// Helper for relative time (e.g., "5m ago", "Yesterday", "Feb 15")
export const timeAgo = (dateString: string | null | undefined): string => {
    if (!dateString) return '';
    const now = new Date();
    const date = safeDate(dateString);

    const isToday = date.toDateString() === now.toDateString();

    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    // 1. If older than yesterday, show the date (e.g., "Feb 15")
    if (!isToday && !isYesterday) {
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }

    // 2. If yesterday, return 'Yesterday'
    if (isYesterday) {
        return 'Yesterday';
    }

    // 3. If today, show relative minutes/hours
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return Math.floor(seconds / 60) + "m ago";
    return Math.floor(seconds / 3600) + "h ago";
};
